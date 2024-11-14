import type {CSSProperties, SyntheticEvent} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {EventsResults} from 'sentry/utils/profiling/hooks/types';
import type {FunctionsField} from 'sentry/utils/profiling/hooks/useProfilingTransactionQuickSummary';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';

interface FunctionsMiniGridProps {
  functions: EventsResults<FunctionsField>['data'];
  onLinkClick: (e: SyntheticEvent) => void;
  organization: Organization;
  project: Project;
}

export function FunctionsMiniGrid(props: FunctionsMiniGridProps) {
  const {organization, project, functions, onLinkClick} = props;

  return (
    <FunctionsMiniGridContainer>
      <FunctionsMiniGridHeader>{t('Slowest app functions')}</FunctionsMiniGridHeader>
      <FunctionsMiniGridHeader align="right">
        {t('Total Self Time')}
      </FunctionsMiniGridHeader>
      <FunctionsMiniGridHeader align="right">{t('Count')}</FunctionsMiniGridHeader>

      {functions?.map((f, idx) => {
        if (!defined(f)) {
          return null;
        }

        let rendered = <Fragment>{f.function}</Fragment>;

        const example = f['all_examples()']?.[0];
        if (defined(example)) {
          const target = generateProfileRouteFromProfileReference({
            orgSlug: organization.slug,
            projectSlug: project?.slug ?? '',
            frameName: f.function as string,
            framePackage: f.package as string,
            reference: example,
          });
          rendered = (
            <Link to={target} onClick={onLinkClick}>
              {f.function}
            </Link>
          );
        }

        return (
          <Fragment key={idx}>
            <FunctionsMiniGridCell title={f.function as string}>
              <FunctionNameTextTruncate>{rendered}</FunctionNameTextTruncate>
            </FunctionsMiniGridCell>
            <FunctionsMiniGridCell align="right">
              <PerformanceDuration nanoseconds={f['sum()'] as number} abbreviation />
            </FunctionsMiniGridCell>
            <FunctionsMiniGridCell align="right">
              <NumberContainer>{f['count()']}</NumberContainer>
            </FunctionsMiniGridCell>
          </Fragment>
        );
      })}
    </FunctionsMiniGridContainer>
  );
}

export function FunctionsMiniGridLoading() {
  return (
    <Flex align="stretch" justify="center" column h="100%">
      <Flex align="center" justify="center">
        <LoadingIndicator mini />
      </Flex>
    </Flex>
  );
}

export function FunctionsMiniGridEmptyState() {
  return (
    <Flex align="stretch" justify="center" column h="100%">
      <Flex align="center" justify="center">
        {t('No functions data')}
      </Flex>
    </Flex>
  );
}

export const FunctionsMiniGridContainer = styled('div')`
  display: grid;
  grid-template-columns: 60% 20% 20%;
`;

export const FunctionsMiniGridHeader = styled('span')<{
  align?: CSSProperties['textAlign'];
}>`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
  text-align: ${p => p.align};
`;

export const FunctionsMiniGridCell = styled('div')<{align?: CSSProperties['textAlign']}>`
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: ${p => p.align};
  padding: ${space(0.5)} 0px;
`;

const NumberContainer = styled(`div`)`
  text-align: right;
`;

const FunctionNameTextTruncate = styled('div')`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
