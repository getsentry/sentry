import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import NumberField from 'sentry/components/forms/fields/numberField';
import RadioField from 'sentry/components/forms/fields/radioField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';

export type ReprocessEventModalOptions = {
  groupId: Group['id'];
  organization: Organization;
};

export function ReprocessingEventModal({
  Header,
  Body,
  organization,
  closeModal,
  groupId,
}: ModalRenderProps & ReprocessEventModalOptions) {
  const [maxEvents, setMaxEvents] = useState<number | undefined>(undefined);

  function handleSuccess() {
    closeModal();
    window.location.reload();
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Reprocess Events')}</h4>
      </Header>
      <Body>
        <Introduction>
          {t(
            'Reprocessing applies new debug files and grouping enhancements to this Issue. Please consider these impacts:'
          )}
        </Introduction>
        <StyledList symbol="bullet">
          <ListItem>
            {tct(
              "[strong:Quota applies.] Every event you choose to reprocess counts against your plan's quota. Rate limits and spike protection do not apply.",
              {strong: <strong />}
            )}
          </ListItem>
          <ListItem>
            {tct(
              '[strong:Attachment storage required.] If your events come from minidumps or unreal crash reports, you must have [link:attachment storage] enabled.',
              {
                strong: <strong />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/native/enriching-events/attachments/#crash-reports-and-privacy" />
                ),
              }
            )}
          </ListItem>
          <ListItem>
            {t(
              'Please wait one hour after upload before attempting to reprocess missing debug files.'
            )}
          </ListItem>
        </StyledList>
        <Introduction>
          {tct('For more information, please refer to [link:the documentation.]', {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/error-monitoring/reprocessing/" />
            ),
          })}
        </Introduction>
        <Form
          submitLabel={t('Reprocess Events')}
          apiEndpoint={`/organizations/${organization.slug}/issues/${groupId}/reprocessing/`}
          apiMethod="POST"
          initialData={{maxEvents: undefined, remainingEvents: 'keep'}}
          onSubmitSuccess={handleSuccess}
          onSubmitError={() =>
            addErrorMessage(t('Failed to reprocess. Please check your input.'))
          }
          onCancel={closeModal}
          footerClass="modal-footer"
        >
          <NumberField
            name="maxEvents"
            label={t('Number of events to be reprocessed')}
            help={t('If you set a limit, we will reprocess your most recent events.')}
            placeholder={t('Reprocess all events')}
            onChange={value => setMaxEvents(!isNaN(value) ? Number(value) : undefined)}
            min={1}
          />

          <RadioField
            orientInline
            label={t('Remaining events')}
            help={t('What to do with the events that are not reprocessed.')}
            name="remainingEvents"
            choices={[
              ['keep', t('Keep')],
              ['delete', t('Delete')],
            ]}
            disabled={maxEvents === undefined}
          />
        </Form>
      </Body>
    </Fragment>
  );
}

const Introduction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledList = styled(List)`
  gap: ${space(1)};
  margin-bottom: ${space(4)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
