/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @typedef {Object} TextFragment
 * @property {string} textStart
 * @property {string} textEnd
 * @property {string} prefix
 * @property {string} suffix
 */

const FRAGMENT_DIRECTIVES = ['text'];

// Block elements. elements of a text fragment cannot cross the boundaries of a
// block element. Source for the list:
// https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements#Elements
const BLOCK_ELEMENTS = [
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DETAILS',
  'DIALOG',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HGROUP',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'UL',
];

// Characters that indicate a word boundary. Use the script
// tools/generate-boundary-regex.js if it's necessary to modify or regenerate
// this. Because it's a hefty regex, this should be used infrequently and only
// on single-character strings.
const BOUNDARY_CHARS = /[\t-\r -#%-\*,-\/:;\?@\[-\]_\{\}\x85\xA0\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u1680\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2000-\u200A\u2010-\u2029\u202F-\u2043\u2045-\u2051\u2053-\u205F\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E44\u3000-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD807[\uDC41-\uDC45\uDC70\uDC71]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/u;

/**
 * Get all text fragments from a string
 * @param {string} hash - string retrieved from Location#hash.
 * @return {{text: string[]}} Text Fragments contained in the hash.
 */
export const getFragmentDirectives = (hash) => {
  const fragmentDirectivesStrings = hash
    .replace(/#.*?:~:(.*?)/, '$1')
    .split(/&?text=/)
    .filter(Boolean);
  if (!fragmentDirectivesStrings.length) {
    return {};
  } else {
    return { text: fragmentDirectivesStrings };
  }
};

/**
 * Decompose text fragment strings into objects, describing each part of each text fragment.
 * @param {{text: string[]}} fragmentDirectives - Text fragment to decompose into separate elements.
 * @return {{text: TextFragment[]}} Text Fragments, each containing textStart, textEnd, prefix and suffix.
 */
export const parseFragmentDirectives = (fragmentDirectives) => {
  const parsedFragmentDirectives = {};
  for (const [
    fragmentDirectiveType,
    fragmentDirectivesOfType,
  ] of Object.entries(fragmentDirectives)) {
    if (FRAGMENT_DIRECTIVES.includes(fragmentDirectiveType)) {
      parsedFragmentDirectives[
        fragmentDirectiveType
      ] = fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
        return parseTextFragmentDirective(fragmentDirectiveOfType);
      });
    }
  }
  return parsedFragmentDirectives;
};

/**
 * Decompose a string into an object containing all the parts of a text fragment.
 * @param {string} textFragment - String to decompose.
 * @return {TextFragment} Object containing textStart, textEnd, prefix and suffix of the text fragment.
 */
const parseTextFragmentDirective = (textFragment) => {
  const TEXT_FRAGMENT = /^(?:(.+?)-,)?(?:(.+?))(?:,(.+?))?(?:,-(.+?))?$/;
  return {
    prefix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$1')),
    textStart: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$2')),
    textEnd: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$3')),
    suffix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$4')),
  };
};

/**
 * Mark the text fragments with `<mark>` tags.
 * @param {{text: TextFragment[]}} parsedFragmentDirectives - Text fragments to process.
 * @return {{text: (Element[])[]}} `<mark>` elements created to highlight the text fragments.
 */
export const processFragmentDirectives = (parsedFragmentDirectives) => {
  const processedFragmentDirectives = {};
  for (const [
    fragmentDirectiveType,
    fragmentDirectivesOfType,
  ] of Object.entries(parsedFragmentDirectives)) {
    if (FRAGMENT_DIRECTIVES.includes(fragmentDirectiveType)) {
      processedFragmentDirectives[
        fragmentDirectiveType
      ] = fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
        return processTextFragmentDirective(fragmentDirectiveOfType);
      });
    }
  }
  return processedFragmentDirectives;
};

/**
 * Searches the document for a given text fragment and, if found, wraps the
 * corresponding text in one or more `<mark>` element(s).
 *
 * @param {TextFragment} textFragment - Text Fragment to highlight.
 * @return {Element[]} `<mark>` elements created to highlight the text fragment,
 *     if an exact match was found.
 */
export const processTextFragmentDirective = (textFragment) => {
  // TODO: currently this only supports textStart matches.
  const range = document.createRange();
  range.selectNodeContents(document.body);
  const match = findTextInRange(textFragment.textStart, range);
  if (match != null) {
    return markRange(match);
  }
  return [];
};

/**
 * Given a Range, wraps its text contents in one or more <mark> elements.
 * <mark> elements can't cross block boundaries, so this function walks the
 * tree to find all the relevant text nodes and wraps them.
 * @param {Range} range - the range to mark. Must start and end inside of
 *     text nodes.
 * @return {Element[]} The <mark> nodes that were created.
 */
const markRange = (range) => {
  if (
    range.startContainer.nodeType != Node.TEXT_NODE ||
    range.endContainer.nodeType != Node.TEXT_NODE
  )
    return [];

  // If the range is entirely within a single node, just surround it.
  if (range.startContainer === range.endContainer) {
    const trivialMark = document.createElement('mark');
    range.surroundContents(trivialMark);
    return [trivialMark];
  }

  // Start node -- special case
  const startNode = range.startContainer;
  const startNodeSubrange = range.cloneRange();
  startNodeSubrange.setEndAfter(startNode);

  // End node -- special case
  const endNode = range.endContainer;
  const endNodeSubrange = range.cloneRange();
  endNodeSubrange.setStartBefore(endNode);

  // In between nodes
  const marks = [];
  range.setStartAfter(startNode);
  range.setEndBefore(endNode);
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;

        if (
          BLOCK_ELEMENTS.includes(node.tagName) ||
          node.nodeType === Node.TEXT_NODE
        )
          return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    },
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const mark = document.createElement('mark');
      node.parentNode.insertBefore(mark, node);
      mark.appendChild(node);
      marks.push(mark);
    }
    node = walker.nextNode();
  }

  const startMark = document.createElement('mark');
  startNodeSubrange.surroundContents(startMark);
  const endMark = document.createElement('mark');
  endNodeSubrange.surroundContents(endMark);

  return [startMark, ...marks, endMark];
};

/**
 * Scrolls an element into view, following the recommendation of
 * https://wicg.github.io/scroll-to-text-fragment/#navigating-to-text-fragment
 * @param {Element} element - Element to scroll into view.
 */
export const scrollElementIntoView = (element) => {
  const behavior = {
    behavior: 'auto',
    block: 'center',
    inline: 'nearest',
  };
  element.scrollIntoView(behavior);
};

/**
 * Extracts all the text nodes within the given range.
 * @param {Node} root - the root node in which to search
 * @param {Range} range - a range restricting the scope of extraction
 * @return {TextNode[][]} - a list of lists of text nodes, in document order.
 *     Lists represent block boundaries; i.e., two nodes appear in the same list
 *     iff there are no block element starts or ends in between them.
 */
const getAllTextNodes = (root, range) => {
  const blocks = [];
  let tmp = [];

  const nodes = Array.from(
    getElementsIn(root, (node) => {
      if (range !== undefined && !range.intersectsNode(node))
        return NodeFilter.FILTER_REJECT;

      if (node instanceof HTMLElement) {
        const nodeStyle = window.getComputedStyle(node);
        // If the node is not rendered, just skip it.
        if (nodeStyle.visibility === 'hidden' || nodeStyle.display === 'none') {
          return NodeFilter.FILTER_REJECT;
        }
      }
      return NodeFilter.FILTER_ACCEPT;
    }),
  );

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      tmp.push(node);
    } else if (
      node instanceof HTMLElement &&
      BLOCK_ELEMENTS.includes(node.tagName) &&
      tmp.length > 0
    ) {
      // If this is a block element, the current set of text nodes in |tmp| is
      // complete, and we need to move on to a new one.
      blocks.push(tmp);
      tmp = [];
    }
  }
  if (tmp.length > 0) blocks.push(tmp);

  return blocks;
};

/**
 * Returns the textContent of all the textNodes and normalizes strings by replacing duplicated spaces with single space.
 * @param {Node[]} nodes - TextNodes to get the textContent from.
 * @param {Number} startOffset - Where to start in the first TextNode.
 * @param {Number|undefined} endOffset Where to end in the last TextNode.
 * @return {string} Entire text content of all the nodes, with spaces normalized.
 */
const getTextContent = (nodes, startOffset, endOffset) => {
  let str = '';
  if (nodes.length === 1) {
    str = nodes[0].textContent.substring(startOffset, endOffset);
  } else {
    str =
      nodes[0].textContent.substring(startOffset) +
      nodes.slice(1, -1).reduce((s, n) => s + n.textContent, '') +
      nodes.slice(-1)[0].textContent.substring(0, endOffset);
  }
  return str.replace(/[\t\n\r ]+/g, ' ');
};

/**
 * @callback ElementFilterFunction
 * @param {HTMLElement} element - Node to accept, reject or skip.
 * @returns {number} Either NodeFilter.FILTER_ACCEPT, NodeFilter.FILTER_REJECT or NodeFilter.FILTER_SKIP.
 */

/**
 * Returns all nodes inside root using the provided filter.
 * @generator
 * @param {Node} root - Node where to start the TreeWalker.
 * @param {ElementFilterFunction} filter - Filter provided to the TreeWalker's acceptNode filter.
 * @yield {HTMLElement} All elements that were accepted by filter.
 */
function* getElementsIn(root, filter) {
  const treeWalker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    { acceptNode: filter },
  );

  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    yield currentNode;
  }
}

/**
 * Returns a range pointing to the first instance of |query| within |range|.
 * @param {String} query - the string to find
 * @param {Range} range - the range in which to search
 * @return {Range|Undefined} - The first found instance of |query| within
 *     |range|.
 */
const findTextInRange = (query, range) => {
  const textNodeLists = getAllTextNodes(range.commonAncestorContainer, range);
  for (const list of textNodeLists) {
    const found = findRangeFromNodeList(query, range, list);
    if (found !== undefined) return found;
  }
  return undefined;
};

/**
 * Finds a range pointing to the first instance of |query| within |range|,
 * searching over the text contained in a list |nodeList| of relevant textNodes.
 * @param {String} query - the string to find
 * @param {Range} range - the range in which to search
 * @param {Node[]} textNodes - the visible text nodes within |range|
 * @return {Range} - the found range, or undefined if no such range could be
 *     found
 */
const findRangeFromNodeList = (query, range, textNodes) => {
  if (!query || !range || !(textNodes || []).length) return undefined;
  const data = normalizeString(getTextContent(textNodes, 0, undefined));
  const normalizedQuery = normalizeString(query);
  let searchStart = textNodes[0] === range.startNode ? range.startOffset : 0;
  let start;
  let end;
  let matchIndex;
  while (matchIndex === undefined) {
    matchIndex = data.indexOf(normalizedQuery, searchStart);
    if (matchIndex === -1) return undefined;
    if (isWordBounded(data, matchIndex, normalizedQuery.length)) {
      start = getBoundaryPointAtIndex(matchIndex, textNodes, /* isEnd=*/ false);
      end = getBoundaryPointAtIndex(
        matchIndex + normalizedQuery.length,
        textNodes,
        /* isEnd=*/ true,
      );
    } else {
      searchStart = matchIndex + 1;
      matchIndex = undefined;
    }
  }
  if (start !== undefined && end !== undefined) {
    const foundRange = document.createRange();
    foundRange.setStart(start.node, start.offset);
    foundRange.setEnd(end.node, end.offset);

    // Verify that |foundRange| is a subrange of |range|
    if (
      range.compareBoundaryPoints(Range.START_TO_START, foundRange) <= 0 &&
      range.compareBoundaryPoints(Range.END_TO_END, foundRange) >= 0
    ) {
      return foundRange;
    }
  }
  return undefined;
};

/**
 * Provides the data needed for calling setStart/setEnd on a Range.
 * @typedef {Object} BoundaryPoint
 * @property {Node} node
 * @property {Number} offset
 */

/**
 * Generates a boundary point pointing to the given text position.
 * @param {Number} index - the text offset indicating the start/end of a
 *     substring of the concatenated, normalized text in |textNodes|
 * @param {Node[]} textNodes - the text Nodes whose contents make up the search
 *     space
 * @param {bool} isEnd - indicates whether the offset is the start or end of the
 *     substring
 * @return {BoundaryPoint} - a boundary point suitable for setting as the start
 *     or end of a Range, or undefined if it couldn't be computed.
 */
const getBoundaryPointAtIndex = (index, textNodes, isEnd) => {
  let counted = 0;
  let normalizedData;
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    if (!normalizedData) normalizedData = normalizeString(node.data);
    let nodeEnd = counted + normalizedData.length;
    if (isEnd) nodeEnd += 1;
    if (nodeEnd > index) {
      // |index| falls within this node, but we need to turn the offset in the
      // normalized data into an offset in the real node data.
      const normalizedOffset = index - counted;
      let denormalizedOffset = Math.min(index - counted, node.data.length);

      // Walk through the string until denormalizedOffset produces a substring
      // that corresponds to the target from the normalized data.
      const targetSubstring = isEnd
        ? normalizedData.substring(0, normalizedOffset)
        : normalizedData.substring(normalizedOffset);

      let candidateSubstring = isEnd
        ? normalizeString(node.data.substring(0, denormalizedOffset))
        : normalizeString(node.data.substring(denormalizedOffset));

      // We will either lengthen or shrink the candidate string to approach the
      // length of the target string. If we're looking for the start, adding 1
      // makes the candidate shorter; if we're looking for the end, it makes the
      // candidate longer.
      const direction =
        (isEnd ? -1 : 1) *
        (targetSubstring.length > candidateSubstring.length ? -1 : 1);

      while (
        denormalizedOffset >= 0 &&
        denormalizedOffset <= node.data.length
      ) {
        if (candidateSubstring.length === targetSubstring.length)
          return { node: node, offset: denormalizedOffset };

        denormalizedOffset += direction;

        candidateSubstring = isEnd
          ? normalizeString(node.data.substring(0, denormalizedOffset))
          : normalizeString(node.data.substring(denormalizedOffset));
      }
    }
    counted += normalizedData.length;

    if (i + 1 < textNodes.length) {
      // Edge case: if this node ends with a whitespace character and the next
      // node starts with one, they'll be double-counted relative to the
      // normalized version. Subtract 1 from |counted| to compensate.
      const nextNormalizedData = normalizeString(textNodes[i + 1].data);
      if (
        normalizedData.slice(-1) === ' ' &&
        nextNormalizedData.slice(0, 1) === ' '
      ) {
        counted -= 1;
      }
      // Since we already normalized the next node's data, hold on to it for the
      // next iteration.
      normalizedData = nextNormalizedData;
    }
  }
  return undefined;
};

/**
 * Checks if a substring is word-bounded in the context of a longer string.
 * It's not feasible to match the spec exactly as Intl.Segmenter is not yet
 * widely supported. Instead, returns true iff:
 *  - startPos == 0 OR char before start is a boundary char, AND
 *  - length indicates end of string OR char after end is a boundary char
 * Where boundary chars are whitespace/punctuation defined in the const above.
 *
 * This causes the known issue that some languages, notably Japanese, only match
 * at the level of roughly a full clause or sentence, rather than a word.
 * @param {String} text - the text to search
 * @param {Number} startPos - the index of the start of the substring
 * @param {Number} length - the length of the substring
 * @return {bool} - true iff startPos and length point to a word-bounded
 *     substring of |text|.
 */
const isWordBounded = (text, startPos, length) => {
  if (
    startPos < 0 ||
    startPos >= text.length ||
    length <= 0 ||
    startPos + length > text.length
  ) {
    return false;
  }

  if (startPos !== 0 && !text[startPos - 1].match(BOUNDARY_CHARS)) return false;

  if (
    startPos + length !== text.length &&
    !text[startPos + length].match(BOUNDARY_CHARS)
  )
    return false;

  return true;
};

/**
 * @param {String} str - a string to be normalized
 * @return {String} - a normalized version of |str| with all consecutive
 *     whitespace chars converted to a single ' ' and all diacriticals removed
 *     (e.g., 'é' -> 'e').
 */
const normalizeString = (str) => {
  // First, decompose any characters with diacriticals. Then, turn all
  // consecutive whitespace characters into a standard " ", and strip out
  // anything in the Unicode U+0300..U+036F (Combining Diacritical Marks) range.
  // This may change the length of the string.
  return (str || '')
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

export const forTesting = {
  markRange: markRange,
  findTextInRange: findTextInRange,
  findRangeFromNodeList: findRangeFromNodeList,
  getBoundaryPointAtIndex: getBoundaryPointAtIndex,
  isWordBounded: isWordBounded,
  normalizeString: normalizeString,
};

// Allow importing module from closure-compiler projects that haven't migrated
// to ES6 modules.
if (typeof goog !== 'undefined') {
  // prettier-ignore
  goog.declareModuleId('googleChromeLabs.textFragmentPolyfill.textFragmentUtils');
}
