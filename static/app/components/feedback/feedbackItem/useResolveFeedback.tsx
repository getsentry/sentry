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
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

function openResolveModal({
  onResolve,
  label,
}: {
  label: string;
  onResolve: () => void | Promise<void>;
}) {
  openModal(({Body, Footer, closeModal}: ModalRenderProps) => (
    <Fragment>
      <Body>{tct('[label] this feedback?', {label})}</Body>
      <Footer>
        <Flex gap={space(1)}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={() => {
              closeModal();
              onResolve();
            }}
          >
            {label}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  ));
}

export default function useResolveFeedback({feedbackItem}: Props) {
  const feedbackId = feedbackItem.feedback_id;

  const api = useApi();
  const organization = useOrganization();
  const {setParamValue: setFeedbackSlug} = useUrlParams('feedbackSlug');
  const {setFeedback} = useInfiniteFeedbackListData();

  const url = useMemo(() => {
    return `/organizations/${organization.slug}/issues/${feedbackId}/`;
  }, [feedbackId, organization]);

  const handleResolve = useCallback(async () => {
    addLoadingMessage(t('Updating feedback...'));
    try {
      await api.requestPromise(url, {
        method: 'PUT',
        data: {status: feedbackItem.status === 'unresolved' ? 'resolved' : 'unresolved'},
      });
      addSuccessMessage(t('Updated feedback'));
      setFeedbackSlug('');
      setFeedback(feedbackId, undefined);
    } catch {
      addErrorMessage(t('An error occurred while resolving the feedback.'));
    }
  }, [api, feedbackId, setFeedback, setFeedbackSlug, url, feedbackItem.status]);

  return {
    onResolve: () =>
      openResolveModal({
        onResolve: handleResolve,
        label: feedbackItem.status === 'unresolved' ? t('Resolve') : t('Unresolve'),
      }),
  };
}
