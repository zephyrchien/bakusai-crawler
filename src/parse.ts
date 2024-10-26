import * as cheerio from 'cheerio';
import * as assert from 'node:assert'
import { AnyNode } from 'domhandler';

type Node = cheerio.Cheerio<AnyNode>;

export type Comment = Content;

export const parse_page = (doc: string): Page => {
  const root = cheerio.load(doc);
  const page = root('.thrWhole .thrWholeLeft');

  const head = parse_head(page);
  const contents = parse_body(page);

  return { head, contents };
}

export interface Page {
  head: PageHead,
  contents: Content[],
}

export interface PageHead {
  prev?: string,
  next?: string,
}

export interface Content {
  id: number,
  time: string,
  text: string,
  reply_id?: number,
  reply_ref?: Content,
}

const parse_head = (page: Node): PageHead => {
  const head = page.find('dl#thr_top #thr_pager')
  const prev = head.find('.sre_mae a');
  const next = head.find('.sre_tsugi a');
  const prev_url = prev.attr('href');
  const next_url = next.attr('href');
  return { prev: prev_url, next: next_url };
}

const parse_body = (page: Node): Content[] => {
  const sections = page.find('dl#res_list').children('.res_list_article');
  const extract_one = (e: AnyNode): Content => {
    const node = cheerio.load(e);

    const head = node('dt > div.res_meta_wrap');
    const id_s = head.find('span.resnumb > a').text();
    assert.ok(id_s[0] == '#');
    const id = parseInt(id_s.replace('#', ''), 10);
    const time = head.find('span[itemprop="commentTime"]').text();

    const body = node('dd.body .resbody[itemprop="commentText"]');
    const text = body.text().trim();

    const reply = body.find('span.resOverlay');
    const reply_origin = reply.data('tipso') as string | undefined;
    const reply_id_s = undef_or(reply_origin, () => reply.find('a').text().trim());
    const reply_id = undef_or(reply_id_s, s => parseInt(s.replace('>>', '').trim(), 10));

    const text_x = undef_or(reply_id_s, s => text.replace(s, '').trim());

    return { id, time, text: text_x ?? text, reply_id };
  }

  return sections.toArray().map(extract_one).sort((a, b) => a.id - b.id);
}

const undef_or = <T, U>(a: T | undefined, f: (ax: T) => U): U | undefined => {
  return !a ? undefined : f(a);
}
