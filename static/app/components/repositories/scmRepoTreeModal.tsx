import {Fragment, useState} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ScmIntegrationTree} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTree';
import {ScmTreeFilters} from 'sentry/components/repositories/scmIntegrationTree/scmTreeFilters';
import type {RepoFilter} from 'sentry/components/repositories/scmIntegrationTree/types';
import {tct} from 'sentry/locale';

interface Props extends ModalRenderProps {
  title: string;
}

export function ScmRepoTreeModal({Header, Body, title}: Props) {
  const [search, setSearch] = useState('');
  const [repoFilter, setRepoFilter] = useState<RepoFilter>('all');

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{title}</Heading>
      </Header>
      <Body>
        <Stack gap="2xl">
          <Text size="md">
            {tct(
              'Integrate with a Seer compatible Source Code Management provider and then connect repositories with Sentry. Seer needs read access to your source code to perform code review, and analyze your issues. [read_the_docs:Read the docs] and our [privacy:AI Privacy Principles] to learn more.',
              {
                privacy: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/" />
                ),
                read_the_docs: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
                ),
              }
            )}
          </Text>
          <Stack gap="lg">
            <Flex gap="sm">
              <ScmTreeFilters
                repoFilter={repoFilter}
                setRepoFilter={setRepoFilter}
                searchTerm={search}
                setSearchTerm={setSearch}
              />
            </Flex>
            <ScmIntegrationTree
              search={search}
              repoFilter={repoFilter}
              providerFilter="seer-supported"
            />
          </Stack>
        </Stack>
      </Body>
    </Fragment>
  );
}
