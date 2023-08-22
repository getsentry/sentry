import {Component} from 'react';
import cls from 'classnames';

import {store} from '../store';
import {elementIsOutside} from '../utils';

import s from './ContextMenu.css';
import ContextMenuItem from './ContextMenuItem';

export default class ContextMenu extends Component {
  componentDidMount() {
    this.boundingRect = this.node.getBoundingClientRect();
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      document.addEventListener('mousedown', this.handleDocumentMousedown, true);
    } else if (prevProps.visible && !this.props.visible) {
      document.removeEventListener('mousedown', this.handleDocumentMousedown, true);
    }
  }

  handleClickHideChunk = () => {
    const {chunk: selectedChunk} = this.props;
    if (selectedChunk && selectedChunk.label) {
      const filteredChunks = store.selectedChunks.filter(
        chunk => chunk.label !== selectedChunk.label
      );
      store.selectedChunks = filteredChunks;
    }
    this.hide();
  };

  handleClickFilterToChunk = () => {
    const {chunk: selectedChunk} = this.props;
    if (selectedChunk && selectedChunk.label) {
      const filteredChunks = store.allChunks.filter(
        chunk => chunk.label === selectedChunk.label
      );
      store.selectedChunks = filteredChunks;
    }
    this.hide();
  };

  handleClickShowAllChunks = () => {
    store.selectedChunks = store.allChunks;
    this.hide();
  };

  /**
   * Handle document-wide `mousedown` events to detect clicks
   * outside the context menu.
   * @param {MouseEvent} e - DOM mouse event object
   * @returns {void}
   */
  handleDocumentMousedown = e => {
    const isSecondaryClick = e.ctrlKey || e.button === 2;
    if (!isSecondaryClick && elementIsOutside(e.target, this.node)) {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    }
  };

  hide() {
    if (this.props.onHide) {
      this.props.onHide();
    }
  }

  saveNode = node => (this.node = node);

  getStyle() {
    const {boundingRect} = this;

    // Upon the first render of this component, we don't yet know
    // its dimensions, so can't position it yet
    if (!boundingRect) {
      return;
    }

    const {coords} = this.props;

    const pos = {
      left: coords.x,
      top: coords.y,
    };

    if (pos.left + boundingRect.width > window.innerWidth) {
      // Shifting horizontally
      pos.left = window.innerWidth - boundingRect.width;
    }

    if (pos.top + boundingRect.height > window.innerHeight) {
      // Flipping vertically
      pos.top = coords.y - boundingRect.height;
    }
    // ts-ignore
    return pos;
  }

  render() {
    const {visible} = this.props;
    const containerClassName = cls({
      [s.container]: true,
      [s.hidden]: !visible,
    });
    const multipleChunksSelected = store.selectedChunks.length > 1;
    return (
      <ul ref={this.saveNode} className={containerClassName} style={this.getStyle()}>
        <ContextMenuItem
          disabled={!multipleChunksSelected}
          onClick={this.handleClickHideChunk}
        >
          Hide chunk
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!multipleChunksSelected}
          onClick={this.handleClickFilterToChunk}
        >
          Hide all other chunks
        </ContextMenuItem>
        <hr />
        <ContextMenuItem
          disabled={store.allChunksSelected}
          onClick={this.handleClickShowAllChunks}
        >
          Show all chunks
        </ContextMenuItem>
      </ul>
    );
  }
}
