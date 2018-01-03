import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';
import createReactClass from 'create-react-class';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import ProjectState from '../mixins/projectState';

import AutoSelectText from './autoSelectText';

const ShortId = createReactClass({
  displayName: 'ShortId',

  propTypes: {
    shortId: PropTypes.string,
    project: PropTypes.object,
  },

  mixins: [PureRenderMixin, ProjectState],

  preventPropagation(e) {
    // this is a hack for the stream so the click handler doesn't
    // affect this element
    e.stopPropagation();
  },

  render() {
    let shortId = this.props.shortId;
    if (!shortId) {
      return null;
    }
    return (
      <ShortIdWrapper onClick={this.preventPropagation} className={this.props.className}>
        <AutoSelectText>{shortId}</AutoSelectText>
      </ShortIdWrapper>
    );
  },
});

const ShortIdWrapper = withTheme(
  styled.span`
    white-space: nowrap;
    font-family: ${p => p.theme.fontFamilyMono};

    > span:before {
      content: '#';
      color: ${p => p.theme.gray2};
      padding-right: 2px;
    }
  `
);

export default ShortId;
