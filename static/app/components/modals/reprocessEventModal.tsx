import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Form from 'sentry/components/forms/form';
import NumberField from 'sentry/components/forms/numberField';
import RadioField from 'sentry/components/forms/radioField';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';

const impacts = [
  tct(
    "[strong:Quota applies.] Every event you choose to reprocess counts against your plan's quota. Rate limits and spike protection do not apply.",
    {strong: <strong />}
  ),
  tct(
    '[strong:Attachment storage required.] If your events come from minidumps or unreal crash reports, you must have [link:attachment storage] enabled.',
    {
      strong: <strong />,
      link: (
        <ExternalLink href="https://docs.sentry.io/platforms/native/enriching-events/attachments/#crash-reports-and-privacy" />
      ),
    }
  ),
  t(
    'Please wait one hour after upload before attempting to reprocess missing debug files.'
  ),
];

const remainingEventsChoices: [string, string][] = [
  ['keep', t('Keep')],
  ['delete', t('Delete')],
];

export type ReprocessEventModalOptions = {
  groupId: Group['id'];
  organization: Organization;
};

type Props = ModalRenderProps & ReprocessEventModalOptions;

type State = {
  maxEvents?: number;
};

class ReprocessingEventModal extends Component<Props, State> {
  state: State = {maxEvents: undefined};

  handleSuccess = () => {
    const {closeModal} = this.props;

    closeModal();
    window.location.reload();
  };

  handleError() {
    addErrorMessage(t('Failed to reprocess. Please check your input.'));
  }

  handleMaxEventsChange = (maxEvents: string) => {
    this.setState({maxEvents: Number(maxEvents) || undefined});
  };

  render() {
    const {organization, Header, Body, closeModal, groupId} = this.props;
    const {maxEvents} = this.state;
    const orgSlug = organization.slug;
    const endpoint = `/organizations/${orgSlug}/issues/${groupId}/reprocessing/`;
    const title = t('Reprocess Events');

    return (
      <Fragment>
        <Header closeButton>{title}</Header>
        <Body>
          <Introduction>
            {t(
              'Reprocessing applies new debug files and grouping enhancements to this Issue. Please consider these impacts:'
            )}
          </Introduction>
          <StyledList symbol="bullet">
            {impacts.map((impact, index) => (
              <ListItem key={index}>{impact}</ListItem>
            ))}
          </StyledList>
          <Introduction>
            {tct('For more information, please refer to [link:the documentation.]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/error-monitoring/reprocessing/" />
              ),
            })}
          </Introduction>
          <Form
            submitLabel={title}
            apiEndpoint={endpoint}
            apiMethod="POST"
            initialData={{maxEvents: undefined, remainingEvents: 'keep'}}
            onSubmitSuccess={this.handleSuccess}
            onSubmitError={this.handleError}
            onCancel={closeModal}
            footerClass="modal-footer"
          >
            <NumberField
              name="maxEvents"
              label={t('Number of events to be reprocessed')}
              help={t('If you set a limit, we will reprocess your most recent events.')}
              placeholder={t('Reprocess all events')}
              onChange={this.handleMaxEventsChange}
              min={1}
            />

            <RadioField
              orientInline
              label={t('Remaining events')}
              help={t('What to do with the events that are not reprocessed.')}
              name="remainingEvents"
              choices={remainingEventsChoices}
              disabled={maxEvents === undefined}
            />
          </Form>
        </Body>
      </Fragment>
    );
  }
}

export default ReprocessingEventModal;

const Introduction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledList = styled(List)`
  gap: ${space(1)};
  margin-bottom: ${space(4)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
