import {Fragment} from 'react';
import {browserHistory} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/profiling/flex';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  FeedbackItemLoaderQueryParams,
  HydratedFeedbackItem,
} from 'sentry/utils/feedback/item/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

function openDeleteModal(organization, projectSlug, feedbackId, location) {
  openModal(({Body, Footer, closeModal}: ModalRenderProps) => (
    <Fragment>
      <Body>
        {t('Deleting this feedback is permanent. Are you sure you wish to continue?')}
      </Body>
      <Footer>
        <Flex gap={space(1)}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="danger"
            onClick={() => {
              closeModal();
              deleteFeedback(organization, projectSlug, feedbackId, location);
            }}
          >
            {t('Delete')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  ));
}

async function deleteFeedback(organization, projectSlug, feedbackId, location) {
  const api = new Client();
  addLoadingMessage(t('Deleting feedback...'));
  try {
    await api.requestPromise(
      `/projects/${organization.slug}/${projectSlug}/feedback/${feedbackId}/`,
      {method: 'DELETE'}
    );
    addSuccessMessage(t('Deleted feedback'));
    browserHistory.push({
      ...location,
      query: {...location.query.query, feedbackSlug: undefined},
    });
  } catch {
    addErrorMessage(t('An error occurred while deleting the feedback.'));
  }
}

export default function DeleteButton({feedbackItem}: Props) {
  const organization = useOrganization();
  const location = useLocation<FeedbackItemLoaderQueryParams>();
  const feedbackId = feedbackItem.feedback_id;
  const feedbackSlug = decodeScalar(location.query.feedbackSlug);
  const projectSlug = feedbackSlug?.split(':')[0];

  return (
    <Button
      priority="danger"
      size="xs"
      icon={<IconDelete size="xs" />}
      onClick={() => openDeleteModal(organization, projectSlug, feedbackId, location)}
    >
      {t('Delete')}
    </Button>
  );
}
