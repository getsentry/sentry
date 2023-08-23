import {Component, CSSProperties} from 'react';
import FoamTree from '@carrotsearch/foamtree';

export default class Treemap extends Component {
  constructor(props) {
    super(props);
    this.treemap = null;
    this.zoomOutDisabled = false;
    this.findChunkNamePartIndex();
  }

  componentDidMount() {
    this.treemap = this.createTreemap();
    window.addEventListener('resize', this.resize);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.data !== this.props.data) {
      this.findChunkNamePartIndex();
      this.treemap.set({
        dataObject: this.getTreemapDataObject(nextProps.data),
      });
    } else if (nextProps.highlightGroups !== this.props.highlightGroups) {
      setTimeout(() => this.treemap.redraw());
    }
  }

  shouldComponentUpdate() {
    return false;
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resize);
    this.treemap.dispose();
  }

  saveNodeRef = node => (this.node = node);

  getTreemapDataObject(data = this.props.data) {
    return {groups: data};
  }

  createTreemap() {
    const component = this;
    const {props} = this;

    return new FoamTree({
      element: this.node,
      layout: 'squarified',
      stacking: 'flattened',
      pixelRatio: window.devicePixelRatio || 1,
      maxGroups: Infinity,
      maxGroupLevelsDrawn: Infinity,
      maxGroupLabelLevelsDrawn: Infinity,
      maxGroupLevelsAttached: Infinity,
      wireframeLabelDrawing: 'always',
      groupMinDiameter: 0,
      groupLabelVerticalPadding: 0.2,
      rolloutDuration: 0,
      pullbackDuration: 0,
      fadeDuration: 0,
      groupExposureZoomMargin: 0.2,
      zoomMouseWheelDuration: 300,
      openCloseDuration: 200,
      dataObject: this.getTreemapDataObject(),
      titleBarDecorator(opts, props, vars) {
        vars.titleBarShown = false;
      },
      groupColorDecorator(options, properties, variables) {
        const root = component.getGroupRoot(properties.group);
        const chunkName = component.getChunkNamePart(root.label);
        const hash = /[^0-9]/u.test(chunkName)
          ? hashCode(chunkName)
          : (parseInt(chunkName) / 1000) * 360;
        variables.groupColor = {
          model: 'hsla',
          h: Math.round(Math.abs(hash) % 360),
          s: 60,
          l: 50,
          a: 0.9,
        };

        const {highlightGroups} = component.props;
        const module = properties.group;

        if (highlightGroups && highlightGroups.has(module)) {
          variables.groupColor = {
            model: 'rgba',
            r: 255,
            g: 0,
            b: 0,
            a: 0.8,
          };
        } else if (highlightGroups && highlightGroups.size > 0) {
          // this means a search (e.g.) is active, but this module
          // does not match; gray it out
          // https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/553
          variables.groupColor.s = 10;
        }
      },
      /**
       * Handle Foamtree's "group clicked" event
       * @param {FoamtreeEvent} event - Foamtree event object
       *  (see https://get.carrotsearch.com/foamtree/demo/api/index.html#event-details)
       * @returns {void}
       */
      onGroupClick(event) {
        preventDefault(event);
        if ((event.ctrlKey || event.secondary) && props.onGroupSecondaryClick) {
          props.onGroupSecondaryClick.call(component, event);
          return;
        }
        component.zoomOutDisabled = false;
        this.zoom(event.group);
      },
      onGroupDoubleClick: preventDefault,
      onGroupHover(event) {
        // Ignoring hovering on `FoamTree` branding group and the root group
        if (
          event.group &&
          (event.group.attribution || event.group === this.get('dataObject'))
        ) {
          event.preventDefault();
          if (props.onMouseLeave) {
            props.onMouseLeave.call(component, event);
          }
          return;
        }

        if (props.onGroupHover) {
          props.onGroupHover.call(component, event);
        }
      },
      onGroupMouseWheel(event) {
        const {scale} = this.get('viewport');
        const isZoomOut = event.delta < 0;

        if (isZoomOut) {
          if (component.zoomOutDisabled) {
            return preventDefault(event);
          }
          if (scale < 1) {
            component.zoomOutDisabled = true;
            preventDefault(event);
          }
        } else {
          component.zoomOutDisabled = false;
        }
      },
    });
  }

  getGroupRoot(group) {
    let nextParent;
    while (!group.isAsset && (nextParent = this.treemap.get('hierarchy', group).parent)) {
      group = nextParent;
    }
    return group;
  }

  zoomToGroup(group) {
    this.zoomOutDisabled = false;

    while (group && !this.treemap.get('state', group).revealed) {
      group = this.treemap.get('hierarchy', group).parent;
    }

    if (group) {
      this.treemap.zoom(group);
    }
  }

  isGroupRendered(group) {
    const groupState = this.treemap.get('state', group);
    return !!groupState && groupState.revealed;
  }

  update() {
    this.treemap.update();
  }

  resize = () => {
    const {props} = this;
    this.treemap.resize();

    if (props.onResize) {
      props.onResize();
    }
  };

  /**
   * Finds patterns across all chunk names to identify the unique "name" part.
   */
  findChunkNamePartIndex() {
    const splitChunkNames = this.props.data.map(chunk =>
      chunk.label.split(/[^a-z0-9]/iu)
    );
    const longestSplitName = Math.max(...splitChunkNames.map(parts => parts.length));
    const namePart = {
      index: 0,
      votes: 0,
    };
    for (let i = longestSplitName - 1; i >= 0; i--) {
      const identifierVotes = {
        name: 0,
        hash: 0,
        ext: 0,
      };
      let lastChunkPart = '';
      for (const splitChunkName of splitChunkNames) {
        const part = splitChunkName[i];
        if (part === undefined || part === '') {
          continue;
        }
        if (part === lastChunkPart) {
          identifierVotes.ext++;
        } else if (
          /[a-z]/u.test(part) &&
          /[0-9]/u.test(part) &&
          part.length === lastChunkPart.length
        ) {
          identifierVotes.hash++;
        } else if (/^[a-z]+$/iu.test(part) || /^[0-9]+$/u.test(part)) {
          identifierVotes.name++;
        }
        lastChunkPart = part;
      }
      if (identifierVotes.name >= namePart.votes) {
        namePart.index = i;
        namePart.votes = identifierVotes.name;
      }
    }
    this.chunkNamePartIndex = namePart.index;
  }

  getChunkNamePart(chunkLabel) {
    return chunkLabel.split(/[^a-z0-9]/iu)[this.chunkNamePartIndex] || chunkLabel;
  }

  render() {
    return (
      <div
        style={{width: '100%', height: 'calc(100vh - 300px)'}}
        {...this.props}
        ref={this.saveNodeRef}
      />
    );
  }
}

function preventDefault(event) {
  event.preventDefault();
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hash = (hash << 5) - hash + code;
    hash = hash & hash;
  }
  return hash;
}
