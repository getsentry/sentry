import {CSSProperties, Fragment, SyntheticEvent} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Flex} from 'sentry/components/profiling/flex';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {EventsResults} from 'sentry/utils/profiling/hooks/types';
import {generateProfileFlamechartRouteWithHighlightFrame} from 'sentry/utils/profiling/routes';

const functionsFields = [
  'package',
  'function',
  'count()',
  'sum()',
  'examples()',
] as const;

type FunctionsField = (typeof functionsFields)[number];

interface FunctionsMiniGridProps {
  functions: EventsResults<FunctionsField>['data'];
  onLinkClick: (e: SyntheticEvent) => void;
  organization: Organization;
  project: Project;
}

export function FunctionsMiniGrid(props: FunctionsMiniGridProps) {
  const {organization, project, functions, onLinkClick} = props;

  const linkToFlamechartRoute = (
    profileId: string,
    frameName: string,
    framePackage: string
  ) => {
    return generateProfileFlamechartRouteWithHighlightFrame({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      profileId,
      frameName,
      framePackage,
    });
  };
  return (
    <FunctionsMiniGridContainer>
      <FunctionsMiniGridHeader>{t('Slowest app functions')}</FunctionsMiniGridHeader>
      <FunctionsMiniGridHeader align="right">
        {t('Total Self Time')}
      </FunctionsMiniGridHeader>
      <FunctionsMiniGridHeader align="right">{t('Count')}</FunctionsMiniGridHeader>

      {functions &&
        functions.map((f, idx) => {
          if (!defined(f)) {
            return null;
          }

          const exampleProfileIdRaw = f['examples()']![0];
          const exampleProfileId = exampleProfileIdRaw.replaceAll('-', '');
          return (
            <Fragment key={idx}>
              <FunctionsMiniGridCell title={f.function as string}>
                <FunctionNameTextTruncate>
                  <Link
                    to={linkToFlamechartRoute(
                      exampleProfileId,
                      f.function as string,
                      f.package as string
                    )}
                    onClick={onLinkClick}
                  >
                    {f.function}
                  </Link>
                </FunctionNameTextTruncate>
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
  font-weight: 600;
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
