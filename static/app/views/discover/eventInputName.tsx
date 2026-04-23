import styled from '@emotion/styled';

import {EditableText} from 'sentry/components/editableText';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import {handleUpdateQueryName} from './savedQuery/utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
};

const NAME_DEFAULT = t('Untitled query');
const HOMEPAGE_DEFAULT = t('New Query');

/**
 * Allows user to edit the name of the query.
 * By pressing Enter or clicking outside the component, the changes will be saved, if valid.
 */
export function EventInputName({organization, eventView, savedQuery, isHomepage}: Props) {
  const api = useApi();
  const navigate = useNavigate();
  const hasPageFrameFeature = useHasPageFrameFeature();

  function handleChange(nextQueryName: string) {
    // Do not update automatically if
    // 1) It is a new query
    // 2) The new name is same as the old name
    if (!savedQuery || savedQuery.name === nextQueryName) {
      return;
    }

    // This ensures that we are updating SavedQuery.name only.
    // Changes on QueryBuilder table will not be saved.
    const nextEventView = EventView.fromSavedQuery({
      ...savedQuery,
      name: nextQueryName,
    });

    handleUpdateQueryName(api, organization, nextEventView).then(
      (_updatedQuery: SavedQuery) => {
        // The current eventview may have changes that are not explicitly saved.
        // So, we just preserve them and change its name
        const renamedEventView = eventView.clone();
        renamedEventView.name = nextQueryName;

        navigate(normalizeUrl(renamedEventView.getResultsViewUrlTarget(organization)));
      }
    );
  }

  const value = isHomepage ? HOMEPAGE_DEFAULT : eventView.name || NAME_DEFAULT;

  if (hasPageFrameFeature) {
    return (
      <div data-test-id={`discover2-query-name-${value}`}>
        <PageFrameEditableText
          value={value}
          onChange={handleChange}
          errorMessage={t('Please set a name for this query')}
          isDisabled={!eventView.id || isHomepage}
          aria-label={t('Edit query name')}
          maxLength={255}
          variant="compact"
        />
      </div>
    );
  }

  return (
    <Layout.Title data-test-id={`discover2-query-name-${value}`}>
      <EditableText
        value={value}
        onChange={handleChange}
        isDisabled={!eventView.id || isHomepage}
        errorMessage={t('Please set a name for this query')}
      />
    </Layout.Title>
  );
}

const PageFrameEditableText = styled(EditableText)`
  display: flex;
  align-items: center;
  max-width: 100%;

  [data-test-id='editable-text-label'] {
    display: flex;
    align-items: center;
    gap: ${p => p.theme.space['2xs']};
    min-width: 0;
  }

  [data-test-id='editable-text-label'] > *:first-child {
    max-width: 100%;
    line-height: inherit;
  }

  [data-test-id='editable-text-label'] svg {
    flex-shrink: 0;
    opacity: 0;
  }

  [data-test-id='editable-text-input'] {
    display: inline-block;
    min-width: 0;
    max-width: 100%;
    background: transparent !important;
    border-top: 1px solid transparent;
    border-radius: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    padding-right: calc(16px + ${p => p.theme.space['2xs']}) !important;
    box-shadow: none !important;
  }

  [data-test-id='editable-text-input'] input {
    min-height: 0;
    height: auto;
    line-height: inherit;
    font-size: inherit;
    font-weight: inherit;
    background: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  [data-test-id='editable-text-input'] > div:last-child {
    padding: 0;
  }

  :hover,
  :focus-within {
    [data-test-id='editable-text-label'] svg {
      opacity: 1;
    }
  }
`;
