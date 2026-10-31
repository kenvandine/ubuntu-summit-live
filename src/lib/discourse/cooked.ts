// Discourse returns chat messages as server-sanitised HTML ("cooked") with
// site-relative URLs. We are on another origin, so make URLs absolute, open
// links in a new tab, and strip anything active as a second line of defence.

import { config } from '../config'

const BLOCKED = 'script, style, iframe, object, embed, form, input, button, link, meta'

export function prepareCooked(html: string, me?: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild!
  root.querySelectorAll(BLOCKED).forEach((el) => el.remove())

  for (const el of root.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) el.removeAttribute(attr.name)
      else if (name === 'href' || name === 'src') {
        const url = absolute(attr.value)
        if (url) el.setAttribute(attr.name, url)
        else el.removeAttribute(attr.name)
      } else if (name === 'srcset') {
        el.setAttribute('srcset', attr.value.replace(/(^|,\s*)(\/[^\s,]+)/g, (_, sep, path) => sep + absolute(path)))
      }
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
      if (me && el.classList.contains('mention') && el.textContent?.toLowerCase() === `@${me.toLowerCase()}`) {
        el.classList.add('is-me')
      }
    }
    if (el.tagName === 'IMG') el.setAttribute('loading', 'lazy')
  }
  return root.innerHTML
}

function absolute(value: string): string | null {
  try {
    const url = new URL(value, config.discourseUrl + '/')
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

/** Escape plain text for messages we have not heard back about yet. */
export function escapeText(text: string) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML.replace(/\n/g, '<br>')
}

// Quick reactions offered in the picker, as Discourse emoji names.
export const QUICK_REACTIONS = ['+1', 'heart', 'tada', 'laughing', 'clap', 'rocket', 'eyes', 'thinking']

const NATIVE: Record<string, string> = {
  '+1': '👍',
  thumbsup: '👍',
  '-1': '👎',
  heart: '❤️',
  tada: '🎉',
  laughing: '😆',
  joy: '😂',
  smile: '😄',
  clap: '👏',
  rocket: '🚀',
  eyes: '👀',
  thinking: '🤔',
  fire: '🔥',
  wave: '👋',
  '100': '💯',
  open_mouth: '😮',
  pray: '🙏',
  raised_hands: '🙌',
  star_struck: '🤩',
  white_check_mark: '✅',
}

/** Native emoji for common names; null means use Discourse's emoji image. */
export const nativeEmoji = (name: string) => NATIVE[name] ?? null

export const emojiImageUrl = (name: string) =>
  `${config.discourseUrl}/images/emoji/${config.emojiSet}/${encodeURIComponent(name)}.png`
