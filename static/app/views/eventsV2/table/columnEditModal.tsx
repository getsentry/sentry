import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import {DISCOVER2_DOCS_URL} from 'app/constants';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {LightWeightOrganization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Column} from 'app/utils/discover/fields';
import theme from 'app/utils/theme';
import {generateFieldOptions} from 'app/views/eventsV2/utils';

import ColumnEditCollection from './columnEditCollection';

type Props = {
  columns: Column[];
  organization: LightWeightOrganization;
  tagKeys: null | string[];
  measurementKeys: null | string[];
  spanOperationBreakdownKeys?: string[];
  // Fired when column selections have been applied.
  onApply: (columns: Column[]) => void;
} & ModalRenderProps;

type State = {
  columns: Column[];
};

class ColumnEditModal extends Component<Props, State> {
  state: State = {
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
    const {
      Header,
      Body,
      Footer,
      tagKeys,
      measurementKeys,
      spanOperationBreakdownKeys,
      organization,
    } = this.props;
    const fieldOptions = generateFieldOptions({
      organization,
      tagKeys,
      measurementKeys,
      spanOperationBreakdownKeys,
    });
    return (
      <Fragment>
        <Header closeButton>
          <h4>{t('Edit Columns')}</h4>
        </Header>
        <Body>
          <Instruction>
            {tct(
              'To group events, add [functionLink: functions] f(x) that may take in additional parameters. [tagFieldLink: Tag and field] columns will help you view more details about the events (i.e. title).',
              {
                functionLink: (
                  <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
                ),
                tagFieldLink: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/#event-properties" />
                ),
              }
            )}
          </Instruction>
          <ColumnEditCollection
            columns={this.state.columns}
            fieldOptions={fieldOptions}
            onChange={this.handleChange}
            organization={organization}
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
      </Fragment>
    );
  }
}

const Instruction = styled('div')`
  margin-bottom: ${space(4)};
`;

const modalCss = css`
  @media (min-width: ${theme.breakpoints[1]}) {
    width: auto;
    max-width: 900px;
  }
`;

export default ColumnEditModal;
export {modalCss};
