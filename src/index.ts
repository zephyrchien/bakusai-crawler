import * as fs from 'node:fs';

import { parse_page } from "@/parse";
import { Page, PageHead, Content } from "@/parse";

const BASE_URL = process.env.BASE_URL!;

async function main() {
  const th = await thread.fetch(BASE_URL);
}

main();

namespace thread {
  // there's at most 20 * 50 comments in a thread
  const MAX_PAGE_OF_THREAD = 20;

  // thread has the same structure as page
  // it's the concatenated version of all pages
  export interface Thread {
    head: PageHead,
    contents: Content[]
  }

  export const fetch = async (base_url: string): Promise<Thread> => {
    const pages = await fetch_all_pages(base_url);
    const fst = pages[0];
    const b = pages.every(p => p.head == fst.head);
    console.log(b);

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
    return { head: thread_head, contents: thread_contents };
  }

  // fetch all pages of a thread
  const fetch_all_pages = async (base_url: string): Promise<Page[]> => {
    const N = MAX_PAGE_OF_THREAD;
    // note: page=1 is the lastest page where there's largest #id
    const urls = Array(N).fill(0).map((_, page) => {
      return get_page_url(base_url, page);
    });
    const reqs = urls.map(async (url) => {
      return fetch(url).then(r => r.text());
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
}
