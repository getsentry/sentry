import {Fragment, useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {useInfiniteFeedbackListData} from 'sentry/components/feedback/feedbackDataContext';
import {Flex} from 'sentry/components/profiling/flex';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

function openDeleteModal({onDelete}: {onDelete: () => void | Promise<void>}) {
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
              onDelete();
            }}
          >
            {t('Delete')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  ));
}

export default function useDeleteFeedback({feedbackItem}: Props) {
  const feedbackId = feedbackItem.feedback_id;

  const api = useApi();
  const organization = useOrganization();
  const {setParamValue: setFeedbackSlug} = useUrlParams('feedbackSlug');
  const {setFeedback} = useInfiniteFeedbackListData();

  const url = useMemo(() => {
    return `/organizations/${organization.slug}/issues/${feedbackId}/`;
  }, [feedbackId, organization]);

  const handleDelete = useCallback(async () => {
    addLoadingMessage(t('Deleting feedback...'));
    try {
      await api.requestPromise(url, {method: 'DELETE'});
      addSuccessMessage(t('Deleted feedback'));
      setFeedbackSlug('');
      setFeedback(feedbackId, undefined);
    } catch {
      addErrorMessage(t('An error occurred while deleting the feedback.'));
    }
  }, [api, feedbackId, setFeedback, setFeedbackSlug, url]);

  return {
    onDelete: () => openDeleteModal({onDelete: handleDelete}),
  };
}
