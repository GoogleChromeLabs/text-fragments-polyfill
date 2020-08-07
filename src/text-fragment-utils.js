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
 * Highlights a text fragment by surrounding it in a `<mark>` element.
 *
 * Note : If a text fragment only partially intersects an element, the text
 * fragment will be extended to highlight the entire element.
 * @param {TextFragment} textFragment - Text Fragment to highlight.
 * @return {Element[]} `<mark>` element created to highlight the text fragment, if an exact and distinct match was found.
 */
export const processTextFragmentDirective = (textFragment) => {
  const prefixNodes = findText(textFragment.prefix);
  const textStartNodes = findText(textFragment.textStart);
  const textEndNodes = findText(textFragment.textEnd);
  const suffixNodes = findText(textFragment.suffix);

  if (
    prefixNodes.length > 1 ||
    textStartNodes.length > 1 ||
    textEndNodes.length > 1 ||
    suffixNodes.length > 1
  ) {
    return [];
  }

  if (
    !prefixNodes.length &&
    !suffixNodes.length &&
    textStartNodes.length === 1
  ) {
    let startNode;
    let startOffset;
    let endNode;
    let endOffset;
    // Only `textStart`
    if (!textEndNodes.length) {
      [startNode, startOffset] = findRangeNodeAndOffset(
        textStartNodes[0],
        textFragment.textStart,
        true,
      );
      [endNode, endOffset] = findRangeNodeAndOffset(
        textStartNodes[0],
        textFragment.textStart,
        false,
      );
      // Only `textStart` and `textEnd`
    } else if (textEndNodes.length === 1) {
      [startNode, startOffset] = findRangeNodeAndOffset(
        textStartNodes[0],
        textFragment.textStart,
        true,
      );
      [endNode, endOffset] = findRangeNodeAndOffset(
        textEndNodes[0],
        textFragment.textEnd,
        false,
      );
    }
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return markRange(range);
  }
  if (prefixNodes.length) {
    // ToDo
  }
  if (mark.parentElement) {
    return mark;
  } else {
    return;
  }
};

/**
 * Given a Range, wraps its text contents in one or more <mark> elements.
 * <mark> elements can't cross block boundaries, so this function walks the
 * tree to find all the relevant text nodes and wraps them.
 * @param {Range} range - the range to mark. Must start and end inside of
 *     text nodes.
 * @return {Node[]} The <mark> nodes that were created.
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
 * Shrink a Range in the wanted direction.
 * If the end of a text node is reached, the range's start or end will move to the next node.
 * When a TextNode goes outside the Range, it is removed from the provided array.
 * @param {Range} range - Range to shrink
 * @param {Boolean} start - Whether to move the start of the range or not
 * @param {Node[]} textNodes - Nodes in which to iterate
 */
const shrinkRange = (range, start, textNodes) => {
  if (start) {
    let offset = range.startOffset + 1;
    let container = range.startContainer;
    if (offset >= container.textContent.length) {
      textNodes.shift();
      container = textNodes[0];
      offset = 0;
    }
    range.setStart(container, offset);
  } else {
    let offset = range.endOffset - 1;
    let container = range.endContainer;
    if (offset < 0) {
      textNodes.pop();
      container = textNodes[textNodes.length - 1];
      offset = container.textContent.length;
    }
    range.setEnd(container, offset);
  }
};

/**
 * Returns a list of all the text nodes inside an element.
 * null items represent a break in the text content of the element.
 * All block elements that are rendered by the Renderer are considered a break.
 * @param {HTMLElement} root - Root Element
 * @return {(Node|null)[]} All the TextNodes inside the root element. Text breaks are represented by a null value.
 */
const getAllTextNodes = (root) => {
  return Array.from(root.childNodes).reduce((textNodes, node) => {
    // This node is a text node, add it and return.
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node);
      return textNodes;
    }

    const nodeStyle = window.getComputedStyle(node);
    // If the node is not rendered, just skip it.
    if (nodeStyle.visibility === 'hidden' || nodeStyle.display === 'none') {
      return textNodes;
    }

    // This node is a block element.
    if (node instanceof HTMLElement && BLOCK_ELEMENTS.includes(node.tagName)) {
      if (textNodes.slice(-1)[0] !== null) {
        textNodes.push(null);
      }
      return textNodes;
    }

    textNodes.push(...getAllTextNodes(node));
    return textNodes;
  }, []);
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
 * Finds the DOM Node and the exact offset where a string starts or ends.
 * @param {HTMLElement} blockNode - Block element in which to search for a given text.
 * @param {string} text - The text for which to find the position.
 * @param {boolean} start - Whether to return the an offset for the start or the text, or the end.
 * @return {[Node, number]} The DOM Node and the offset where the text starts or ends.
 */
const findRangeNodeAndOffset = (blockNode, text, start) => {
  const textNodes = getAllTextNodes(blockNode);
  const textSections = textNodes.reduce(
    (textParts, textNode) => {
      if (textNode) {
        textParts.slice(-1)[0].push(textNode);
      } else {
        textParts.push([]);
      }
      return textParts;
    },
    [[]],
  );
  const { range, nodes } = textSections
    .map((section) => {
      const r = document.createRange();
      r.setStart(section[0], 0);
      r.setEnd(
        section[section.length - 1],
        section[section.length - 1].textContent.length,
      );
      return { range: r, nodes: section };
    })
    .find(({ nodes }) => {
      return getTextContent(nodes, 0).includes(text);
    });

  let container;
  let offset;
  let i = 0;
  while (
    getTextContent(nodes, range.startOffset, range.endOffset).includes(text)
  ) {
    ++i;
    container = start ? range.startContainer : range.endContainer;
    offset = start ? range.startOffset : range.endOffset;
    shrinkRange(range, start, nodes);
    if (i > 20) break;
  }

  return [container, offset];
};

/**
 * Finds block elements that directly contain a given text.
 * @param {string} text - Text to find.
 * @return {HTMLElement[]} List of block elements that contain the text.
 */
const findText = (text) => {
  if (!text) {
    return [];
  }

  // List of block items that contain the text we're looking for.
  const blockElements = Array.from(
    getElementsIn(document.body, (element) => {
      if (
        BLOCK_ELEMENTS.includes(element.tagName) &&
        element.innerText.replace(/\s/g, ' ').includes(text)
      ) {
        return NodeFilter.FILTER_ACCEPT;
      } else {
        return NodeFilter.FILTER_REJECT;
      }
    }),
  );

  const matches = [];
  for (const element of blockElements) {
    const textParts = Array.from(element.children).reduce(
      (parts, child) => {
        if (BLOCK_ELEMENTS.includes(child.tagName)) {
          return [
            ...parts.slice(0, -1),
            ...parts.slice(-1)[0].split(child.innerText),
          ];
        } else {
          return parts;
        }
      },
      [element.innerText],
    );
    for (const textPart of textParts) {
      if (textPart.includes(text)) {
        matches.push(element);
      }
    }
  }
  return matches;
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
  const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: filter,
  });

  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    yield currentNode;
  }
}

export const forTesting = { markRange: markRange };

// Allow importing module from closure-compiler projects that haven't migrated
// to ES6 modules.
if (typeof goog !== 'undefined') {
  goog.declareModuleId(
    'googleChromeLabs.textFragmentPolyfill.textFragmentUtils',
  );
}
