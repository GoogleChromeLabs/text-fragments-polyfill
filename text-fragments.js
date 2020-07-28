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
(() => {
  if ('fragmentDirective' in Location.prototype) {
    return;
  }
  const FRAGMENT_DIRECTIVES = ['text'];
  // Block elements. elements of a text fragment cannot cross the boundaries of a block element.
  // Source for the list : https://www.w3schools.com/html/html_blocks.asp
  const BLOCK_ELEMENTS = [
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "CANVAS",
    "DD", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE",
    "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER",
    "HR", "LI", "MAIN", "NAV", "NOSCRIPT", "OL", "P", "PRE", "SECTION",
    "TABLE", "TFOOT", "UL", "VIDEO"
  ];

  Location.prototype.fragmentDirective = {};

  const getFragmentDirectives = (hash) => {
    const fragmentDirectivesString = hash.replace(/#.*?:~:(.*?)/, '$1');
    if (!fragmentDirectivesString) {
      return;
    }
    const fragmentDirectivesParams = new URLSearchParams(
      fragmentDirectivesString,
    );
    const fragmentDirectives = {};
    FRAGMENT_DIRECTIVES.forEach((fragmentDirectiveType) => {
      if (fragmentDirectivesParams.has(fragmentDirectiveType)) {
        fragmentDirectives[
          fragmentDirectiveType
        ] = fragmentDirectivesParams.getAll(fragmentDirectiveType);
      }
    });
    return fragmentDirectives;
  };

  const parseFragmentDirectives = (fragmentDirectives) => {
    const parsedFragmentDirectives = {};
    for (const [
      fragmentDirectiveType,
      fragmentDirectivesOfType,
    ] of Object.entries(fragmentDirectives)) {
      if (fragmentDirectiveType === 'text') {
        parsedFragmentDirectives[
          fragmentDirectiveType
        ] = fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
          return parseTextFragmentDirective(fragmentDirectiveOfType);
        });
      }
    }
    return parsedFragmentDirectives;
  };

  const parseTextFragmentDirective = (textFragment) => {
    const TEXT_FRAGMENT = /^(?:(.+?)-,)?(?:(.+?))(?:,(.+?))?(?:,-(.+?))?$/;
    return {
      prefix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$1')),
      textStart: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$2')),
      textEnd: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$3')),
      suffix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$4')),
    };
  };

  const processFragmentDirectives = (parsedFragmentDirectives) => {
    const processedFragmentDirectives = {};
    for (const [
      fragmentDirectiveType,
      fragmentDirectivesOfType,
    ] of Object.entries(parsedFragmentDirectives)) {
      if (fragmentDirectiveType === 'text') {
        processedFragmentDirectives[
          fragmentDirectiveType
        ] = fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
          return processTextFragmentDirective(fragmentDirectiveOfType);
        });
      }
    }
    return processedFragmentDirectives;
  };

  const escapeRegExp = (s) => {
    return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  };

  /**
   * Highlights a text fragment and optionnally scrolls to it.
   * @param textFragment - Fragment to highlight.
   * @param {boolean} scrollTo - If true, the viewport will be scrolled to the text fragment.
   */
  const processTextFragmentDirective = (textFragment, scrollTo) => {
    const prefixNodes = findText(textFragment.prefix);
    const textStartNodes = findText(textFragment.textStart);
    const textEndNodes = findText(textFragment.textEnd);
    const suffixNodes = findText(textFragment.suffix);
    const scrollBehavior = {
      behavior: 'auto',
      block: 'center',
      inline: 'nearest',
    };
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
        [startNode, startOffset] = findRangeNodeAndOffset(textStartNodes[0], textFragment.textStart, true);
        [endNode, endOffset] = findRangeNodeAndOffset(textStartNodes[0], textFragment.textStart, false);
        // Only `textStart` and `textEnd`
      } else if (textEndNodes.length === 1) {
        [startNode, startOffset] = findRangeNodeAndOffset(textStartNodes[0], textFragment.textStart, true);
        [endNode, endOffset] = findRangeNodeAndOffset(textEndNodes[0], textFragment.textEnd, false);
      }
      let range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const mark = document.createElement("mark");
        try {
          range.surroundContents(mark);
        } catch (ex) {
          const commonAncestor = range.commonAncestorContainer;
          while(startNode.parentNode !== commonAncestor) {
            startNode = startNode.parentNode;
            range.setStartBefore(startNode);
          }
          while(endNode.parentNode !== commonAncestor) {
            endNode = endNode.parentNode;
            range.setEndAfter(endNode);
          }
          range.surroundContents(mark);
        }
        window.setTimeout(() => {
          if(scrollTo) {
            mark.scrollIntoView(scrollBehavior);
          }
          let sel = window.getSelection();
          let selRange = document.createRange();
          selRange.selectNode(mark);
          sel.addRange(selRange);
        }, 1);
    }
    if (prefixNodes.length) {
    }
  };

  /**
   * Finds the DOM Node and the exact offset where a string starts or ends. 
   * @param {Node} blockNode - Block node in which to search for a given text.
   * @param {string} text - The text for which to find the position.
   * @param {boolean} start - Whether to return the an offset for the start or the text, or the end.
   * @returns {[Node, number]} The DOM Node and the offset where the text starts or ends.
   */
  const findRangeNodeAndOffset = (blockNode, text, start) => {
    let offset = blockNode.textContent.indexOf(text) + (start ? 0 : text.length);
    let startChildren = [];
    const treeWalker = document.createTreeWalker(blockNode, NodeFilter.SHOW_TEXT);
    let node = treeWalker.nextNode();
    if(node) {
      startChildren.push({
        node,
        start: 0,
        end: node.textContent.length
      });
    }
    while(!!(node = treeWalker.nextNode())) {
      startChildren.push({
        node: node,
        start: startChildren[startChildren.length - 1].end,
        end: startChildren[startChildren.length - 1].end + node.textContent.length
      });
    }
    let anchorNode;
    for(let {node, start, end} of startChildren) {
      if(offset >= start && offset < end) {
        anchorNode = node;
        offset -= start;
        break;
      }
    }
    return [anchorNode, offset];
  }

  /**
   * Find the deepest blocks node that contains the given text.
   * @param {string} text - Text to search for.
   * @returns {Node[]} - Nodes that fully contain the given text. None of the returned nodes contain block nodes.
   */
  const findText = (text) => {
    if (!text) {
      return [];
    }
    const body = document.body;
    const treeWalker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if(!BLOCK_ELEMENTS.includes(node.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if([...node.childNodes].some(n => BLOCK_ELEMENTS.includes(n.tagName))) {
          return NodeFilter.FILTER_SKIP;
        }
        if (node.textContent.includes(text)) { ///!!! Will not find nodes smaller than the searched-for text
          return NodeFilter.FILTER_ACCEPT;
        }
      },
    });

    const nodeList = [];
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
      nodeList.push(currentNode);
      currentNode = treeWalker.nextNode();
    }
    return nodeList;
  };

  const init = () => {
    const hash = document.location.hash;
    if (!hash) {
      return;
    }
    const fragmentDirectives = getFragmentDirectives(hash);
    const parsedFragmentDirectives = parseFragmentDirectives(fragmentDirectives);
    const processedFragmentDirectives = processFragmentDirectives(
      parsedFragmentDirectives,
    );
  };

  document.addEventListener("DOMContentLoaded", init, false);
})();
