import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import ExternalLink from 'app/components/links/externalLink';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import NumberField from 'app/views/settings/components/forms/numberField';
import RadioField from 'app/views/settings/components/forms/radioField';

const impacts = [
  tct(
    '[strong:Data glitches.] During reprocessing you may observe temporary data inconsistencies across the entire product. Those inconsistencies disappear the moment reprocessing is complete.',
    {strong: <strong />}
  ),
  tct(
    '[strong:Attachment storage needs to be enabled.] If your events come from minidumps or unreal crash reports, you must have [link:attachment storage] enabled.',
    {
      strong: <strong />,
      link: (
        <ExternalLink href="https://docs.sentry.io/platforms/native/enriching-events/attachments/#crash-reports-and-privacy" />
      ),
    }
  ),
  tct(
    "[strong:Quota applies.] Every event you choose to reprocess will count against your plan's quota a second time. Rate limits and spike protection do not apply.",
    {strong: <strong />}
  ),
  t('Please wait one hour before attempting to reprocess missing debug files.'),
  t(
    'Reprocessed events will not trigger issue alerts, and reprocessed events are not subject to data forwarding.'
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

class ReprocessingEventModal extends React.Component<Props, State> {
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
      <React.Fragment>
        <Header closeButton>
          <span data-test-id="modal-title">{title}</span>
        </Header>
        <Body>
          <Introduction>
            {t(
              'Reprocessing applies any new debug files or grouping configuration to an Issue. Before you give it a try, you should probably consider these impacts:'
            )}
          </Introduction>
          <StyledList symbol="bullet">
            {impacts.map((impact, index) => (
              <ListItem key={index}>{impact}</ListItem>
            ))}
          </StyledList>
          <Introduction>
            {tct(
              'For more information please refer to [link:the documentation on reprocessing.]',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/error-monitoring/reprocessing/" />
                ),
              }
            )}
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
      </React.Fragment>
    );
  }
}

export default ReprocessingEventModal;

const Introduction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledList = styled(List)`
  grid-gap: ${space(1)};
  margin-bottom: ${space(4)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
