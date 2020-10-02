import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import {DISCOVER2_DOCS_URL} from 'app/constants';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {t, tct} from 'app/locale';
import {LightWeightOrganization} from 'app/types';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {Column} from 'app/utils/discover/fields';
import {trackAnalyticsEvent} from 'app/utils/analytics';

import ColumnEditCollection from './columnEditCollection';

type Props = {
  columns: Column[];
  organization: LightWeightOrganization;
  tagKeys: null | string[];
  measurementKeys: null | string[];
  // Fired when column selections have been applied.
  onApply: (columns: Column[]) => void;
} & ModalRenderProps;

type State = {
  columns: Column[];
};

class ColumnEditModal extends React.Component<Props, State> {
  state = {
    columns: this.props.columns,
  };

  componentDidMount() {
    const {organization} = this.props;

    trackAnalyticsEvent({
      eventKey: 'discover_v2.column_editor.open',
      eventName: 'Discoverv2: Open column editor',
      organization_id: parseInt(organization.id, 10),
    });
  }

  handleChange = (columns: Column[]) => {
    this.setState({columns});
  };

  handleApply = () => {
    this.props.onApply(this.state.columns);
    this.props.closeModal();
  };

  render() {
    const {Header, Body, Footer, tagKeys, measurementKeys, organization} = this.props;
    return (
      <React.Fragment>
        <Header>
          <h4>{t('Edit Columns')}</h4>
        </Header>
        <Body>
          <Instruction>
            {tct(
              'To stack events, add [functionLink: functions] f(x) that may take in additional parameters. [tagFieldLink: Tag and field] columns will help you view more details about the events (i.e. title).',
              {
                functionLink: (
                  <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
                ),
                tagFieldLink: (
                  <ExternalLink href="https://docs.sentry.io/workflow/search/?platform=javascript#event-properties" />
                ),
              }
            )}
          </Instruction>
          <ColumnEditCollection
            organization={organization}
            columns={this.state.columns}
            tagKeys={tagKeys}
            measurementKeys={measurementKeys}
            onChange={this.handleChange}
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button priority="default" href={DISCOVER2_DOCS_URL} external>
              {t('Read the Docs')}
            </Button>
            <Button label={t('Apply')} priority="primary" onClick={this.handleApply}>
              {t('Apply')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

const Instruction = styled('div')`
  margin-bottom: ${space(4)};
`;

const modalCss = css`
  @media (min-width: ${theme.breakpoints[0]}) {
    .modal-dialog {
      width: auto;
      max-width: 750px;
      margin-left: -375px;
    }
  }
`;

export default ColumnEditModal;
export {modalCss};
