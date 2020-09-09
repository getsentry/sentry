import PropTypes from 'prop-types';
import React from 'react';
// import styled from '@emotion/styled';
import {ClassNames, css} from '@emotion/core';

// import {t} from 'app/locale';
// import Search from 'app/components/search';
import StaticSiteSearch from 'app/components/search/staticSiteSearch';
// import theme from 'app/utils/theme';

class HelpSearchModal extends React.Component {
  static propTypes = {
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  render() {
    const {Body} = this.props;

    return (
      <Body>
        <ClassNames>{() => <StaticSiteSearch />}</ClassNames>
      </Body>
    );
  }
}

export const modalCss = css`
  .modal-content {
    padding: 0;
  }
`;

export default HelpSearchModal;
