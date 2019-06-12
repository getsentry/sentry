import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';
import {isEqual} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingContainer from 'app/components/loading/loadingContainer';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {SPECIAL_FIELDS} from './data';
import {QueryLink} from './styles';

export default class Table extends React.Component {
  static propTypes = {
    view: SentryTypes.EventView.isRequired,
    data: PropTypes.arrayOf(PropTypes.object),
    isLoading: PropTypes.bool,
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object,
  };

  state = {
    isChangingTabs: false,
  };

  componentDidUpdate(prevProps) {
    const tabChanged = prevProps.view.id !== this.props.view.id;
    if (!this.state.isChangingTabs && tabChanged) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({isChangingTabs: true});
    }

    if (this.state.isChangingTabs && !isEqual(prevProps.data, this.props.data)) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({isChangingTabs: false});
    }
  }

  renderBody() {
    const {view, data, organization, location} = this.props;
    const {fields} = view.data;

    if (!data) {
      return null;
    }

    if (data.length === 0) {
      return (
        <EmptyStateWarning>
          <p>{t('No results found')}</p>
        </EmptyStateWarning>
      );
    }

    return data.map((row, idx) => (
      <Row key={idx} className={getGridStyle(fields.length)}>
        {fields.map(field => {
          const target = {
            pathname: `/organizations/${organization.slug}/events/`,
            query: {
              ...location.query,
              query: `${field}:${row[field]}`,
            },
          };

          return (
            <Cell key={field}>
              {SPECIAL_FIELDS.hasOwnProperty(field) ? (
                SPECIAL_FIELDS[field].renderFunc(row, {organization, location})
              ) : (
                <QueryLink to={target}>{row[field]}</QueryLink>
              )}
            </Cell>
          );
        })}
      </Row>
    ));
  }

  render() {
    const {isLoading, view, data} = this.props;
    const {fields} = view.data;
    const {isChangingTabs} = this.state;

    // If previous state was empty or we are switching tabs, don't show the
    // reloading state
    const isReloading = !!(data && data.length) && isLoading && !isChangingTabs;

    return (
      <Panel>
        <TableHeader className={getGridStyle(fields.length)}>
          {fields.map(field => (
            <HeaderItem key={field}>
              {SPECIAL_FIELDS.hasOwnProperty(field)
                ? SPECIAL_FIELDS[field].title || field
                : field}
            </HeaderItem>
          ))}
        </TableHeader>
        <StyledPanelBody isLoading={isLoading || isReloading}>
          <LoadingContainer isLoading={isLoading} isReloading={isReloading}>
            {this.renderBody()}
          </LoadingContainer>
        </StyledPanelBody>
      </Panel>
    );
  }
}

function getGridStyle(colCount) {
  return css`
    display: grid;
    grid-template-columns: 3fr repeat(${colCount - 1}, 1fr);
    grid-gap: ${space(1)};
  `;
}

const TableHeader = styled(PanelHeader)`
  padding: ${space(2)} ${space(1)};
`;

const HeaderItem = styled('div')`
  padding: 0 ${space(1)};
`;

const Row = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)};
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const StyledPanelBody = styled(({isLoading, ...props}) => <PanelBody {...props} />)`
  ${p => p.isLoading && 'min-height: 240px;'};
`;
