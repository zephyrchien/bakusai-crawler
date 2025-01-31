import fs from 'node:fs';
import assert from 'node:assert';
import { parse_page } from "@/parse";
import { Page, PageHead, Content } from "@/parse";

const web_fetch = fetch;

namespace thread {
  // there's at most 20 * 50 comments in a thread
  const MAX_PAGE_OF_THREAD = 20;

  // thread has the same structure as page
  // it's the concatenated version of all pages
  export interface Thread {
    id: number,
    head: PageHead,
    contents: Content[]
  }

  export const fetch = async (id: number, base_url: string): Promise<Thread> => {
    const pages = await fetch_all_pages(base_url);
    const fst = pages[0];
    const _eq = (a: PageHead, b: PageHead) => a.next === b.next && a.prev === b.prev;
    if (!pages.every(p => _eq(p.head, fst.head))) {
      const heads = pages.map(e => e.head);
      throw ('inconsistent page head:\n' + JSON.stringify(heads));
    }

    // merge from page=N << page=1
    const thread_head = fst.head;
    const thread_contents = pages.reduceRight((prev: Content[], cur) => {
      const merged = prev.concat(cur.contents);
      // fill references
      cur.contents.filter(e => !!e.reply_id).forEach(e => {
        const x = merged.find(x => x.id == e.reply_id!)!;
        e.reply_ref = x;
      })
      return merged;
    }, [] as Content[]);
    return { id, head: thread_head, contents: thread_contents };
  }

  // fetch all pages of a thread
  const fetch_all_pages = async (base_url: string): Promise<Page[]> => {
    const N = MAX_PAGE_OF_THREAD;
    // note: page=1 is the lastest page where there's largest #id
    const urls = Array(N).fill(0).map((_, page) => {
      return get_page_url(base_url, page);
    });
    const reqs = urls.map(async (url, page) => {
      await new Promise((rsv) => {
        setTimeout(() => { rsv(null); }, page * 300);
      });
      return web_fetch(url).then(r => r.text());
    })

    let raw_pages;
    try {
      raw_pages = await Promise.all(reqs);
    } catch (e) {
      console.error(e);
    }

    const pages = raw_pages!.map(doc => parse_page(doc)).filter(p => {
      return p.contents.length > 0;
    })

    return pages;
  }

  // the url of bakusai is very easy to guess
  // so there's no need to fetch and parse urls from html
  const get_page_url = (base: string, page: number): string => {
    return `${base}/p=${page}`;
  }

  export const test = async (url: string) => {
    const page_url = get_page_url(url, 3);
    const data = await web_fetch(page_url).then(x => x.text());
    const page = parse_page(data);
    console.log(page.head);
  }
}

namespace topic {
  export const fetch = async (url: string): Promise<thread.Thread[]> => {
    const all: thread.Thread[] = [];
    await fetch_rec(0, url, all);
    all.sort((a, b) => a.id - b.id);
    return all;
  }

  const showid = (id: number): string => {
    const sign = id >= 0 ? '+' : '-';
    const value = Math.abs(id).toString().padStart(3, '0');
    return sign + value;
  }

  const fetch_rec = async (id: number, url: string, all: thread.Thread[]) => {
    if (all.find(e => e.id == id)) return;

    await new Promise((rsv) => {
      setTimeout(() => { rsv(null); }, 10_000);
    });
    console.log(`[${showid(id)}]${url}`);
    const th = await thread.fetch(id, url);
    all.push(th);
    console.log(`[${showid(id)}]done!`);

    const [prev, next] = [th.head.prev, th.head.next];
    const rec = (id: number, url?: string) => {
      return url && fetch_rec(id, url!, all);
    }
    await Promise.all([rec(id - 1, prev), rec(id + 1, next)]);
  }
}

const DEV = process.env.DEV == 'true';
const BASE_URL = process.env.BASE_URL!;
const OUT_DIR = process.env.OUT_DIR!;

assert(BASE_URL);
assert(OUT_DIR);

console.log(`dev=${DEV}`);
console.log(`base_url=${BASE_URL}`);
console.log(`out_dir=${OUT_DIR}`);

async function main() {
  const all = await topic.fetch(BASE_URL);
  all.map(e => JSON.stringify(e.contents, null, 2)).forEach((s, i) => {
    fs.writeFile(`${OUT_DIR}/${i + 1}.json`, s, () => { });
  })
}

async function dev() {
  const url = process.env.DEV_URL!;
  thread.test(url);
}

DEV ? dev() : main();
