import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';
import {omit} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingContainer from 'app/components/loading/loadingContainer';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {FIELD_FORMATTERS, SPECIAL_FIELDS} from './data';
import {getFieldRenderer} from './utils';
import SortLink from './sortLink';

export default class Table extends React.Component {
  static propTypes = {
    view: SentryTypes.EventView.isRequired,
    data: PropTypes.object,
    isLoading: PropTypes.bool.isRequired,
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object,
  };

  renderBody() {
    const {view, organization, location, isLoading} = this.props;

    if (!this.props.data || isLoading) {
      return null;
    }
    const {fields} = view.data;
    const {data, meta} = this.props.data;

    if (data.length === 0) {
      return (
        <EmptyStateWarning>
          <p>{t('No results found')}</p>
        </EmptyStateWarning>
      );
    }

    return data.map((row, idx) => (
      <Row key={idx} className={getGridStyle(view)}>
        {fields.map(field => {
          const fieldRenderer = getFieldRenderer(field, meta);
          return <Cell key={field}>{fieldRenderer(row, {organization, location})}</Cell>;
        })}
      </Row>
    ));
  }

  render() {
    const {isLoading, location, view} = this.props;
    const {fields, columnNames, sort} = view.data;
    const defaultSort = sort.length ? sort[0] : null;

    return (
      <Panel>
        <TableHeader className={getGridStyle(view)}>
          {fields.map((field, i) => {
            const title = columnNames[i] || field;

            let sortKey = field;
            if (SPECIAL_FIELDS.hasOwnProperty(field)) {
              sortKey = SPECIAL_FIELDS[field].sortField;
            } else if (FIELD_FORMATTERS.hasOwnProperty(field)) {
              sortKey = FIELD_FORMATTERS[field].sortField ? field : false;
            }

            if (sortKey === false) {
              return <HeaderItem key={field}>{title}</HeaderItem>;
            }

            return (
              <HeaderItem key={field}>
                <SortLink
                  defaultSort={defaultSort}
                  sortKey={sortKey}
                  title={title}
                  location={location}
                />
              </HeaderItem>
            );
          })}
        </TableHeader>
        <StyledPanelBody isLoading={isLoading}>
          <LoadingContainer isLoading={isLoading}>{this.renderBody()}</LoadingContainer>
        </StyledPanelBody>
      </Panel>
    );
  }
}

function getGridStyle(view) {
  const cols = Array.isArray(view.columnWidths)
    ? view.columnWidths.join(' ')
    : `3fr repeat(${view.data.fields.length - 1}, 1fr)`;

  return css`
    display: grid;
    grid-template-columns: ${cols};
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

const StyledPanelBody = styled(props => {
  const otherProps = omit(props, 'isLoading');
  return <PanelBody {...otherProps} />;
})`
  ${p => p.isLoading && 'min-height: 240px;'};
`;
