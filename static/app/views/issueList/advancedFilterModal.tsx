import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueListSearchBar} from 'sentry/views/issueList/searchBar';

export function IssueAdvancedFilterModal({
  Header,
  Body,
  Footer,
  closeModal,
  query,
  onSearch,
}: ModalRenderProps & {onSearch: (query: string) => void; query: string}) {
  const organization = useOrganization();
  const [draft, setDraft] = useState(query);
  const [valid, setValid] = useState(true);

  function apply(value: string) {
    onSearch(value);
    closeModal();
  }

  return (
    <Fragment>
      <Header closeButton>{t('Advanced filter')}</Header>
      <Body>
        <Stack gap="lg">
          <Text variant="muted">
            {t('Use custom fields, comparisons, negation, and AND / OR groups.')}
          </Text>
          <IssueListSearchBar
            organization={organization}
            initialQuery={query}
            disallowLogicalOperators={false}
            autoFocus
            onChange={(value, state) => {
              setDraft(value);
              setValid(state.queryIsValid);
            }}
            onSearch={(value, state) => {
              setDraft(value);
              setValid(state.queryIsValid);
            }}
          />
        </Stack>
      </Body>
      <Footer>
        <Button onClick={closeModal}>{t('Cancel')}</Button>
        <Button variant="primary" disabled={!valid} onClick={() => apply(draft)}>
          {t('Apply filters')}
        </Button>
      </Footer>
    </Fragment>
  );
}
