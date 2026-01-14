import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import type useSuspectFlags from 'sentry/components/issues/suspect/useSuspectFlags';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toRoundedPercent from 'sentry/utils/number/toRoundedPercent';
import {useLocation} from 'sentry/utils/useLocation';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface Props
  extends Pick<ReturnType<typeof useSuspectFlags>, 'isPending' | 'susFlags'> {}

const loadingLabels = [
  t('Crunching the numbers...'),
  t('Taking a look...'),
  t('Randomizing false positives...'),
  t('Still faster than writing unit tests...'),
  t(`It's probably the one that just changed...`),
];

export default function SuspectFlags({isPending, susFlags}: Props) {
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();
  const loadingLabelRef = useRef(
    loadingLabels[Math.floor(Math.random() * loadingLabels.length)]
  );

  if (isPending) {
    return (
      <Fragment>
        <TagHeader>{t('Suspect Flags')}</TagHeader>
        {loadingLabelRef.current}
      </Fragment>
    );
  }

  if (!susFlags.length) {
    return (
      <Fragment>
        <TagHeader>{t('Suspect Flags')}</TagHeader>
        {t('Nothing suspicious')}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <TagHeader>{t('Suspect Flags')}</TagHeader>

      <TagValueGrid>
        <TagValueRow>
          <strong>{t('Flag Name')}</strong>
          <strong>{t('Value')}</strong>
          <strong>{t('Rollout')}</strong>
        </TagValueRow>
        {susFlags.map(flag => {
          const topValue = flag.topValues[0];

          return (
            <TagValueRow key={flag.key}>
              {/* TODO: why is flag.name transformed to TitleCase? */}
              <Tooltip
                skipWrapper
                title={flag.key}
                showOnlyOnOverflow
                data-underline-on-hover="true"
              >
                <StyledLink
                  to={{
                    pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}${flag.key}/`,
                    query: {
                      ...location.query,
                      tab: DrawerTab.FEATURE_FLAGS,
                    },
                  }}
                >
                  {flag.key}
                </StyledLink>
              </Tooltip>
              <span>{topValue?.value}</span>
              <RightAligned>
                {toRoundedPercent((topValue?.count ?? 0) / flag.totalValues)}
              </RightAligned>
            </TagValueRow>
          );
        })}
      </TagValueGrid>
    </Fragment>
  );
}

const TagHeader = styled('h4')`
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const TagValueGrid = styled('ul')`
  display: grid;
  grid-template-columns: auto repeat(3, max-content);
  gap: ${space(0.25)} ${space(1)};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const TagValueRow = styled('li')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;

  align-items: center;
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.primary};
  font-variant-numeric: tabular-nums;

  &:nth-child(2n) {
    background-color: ${p => Color(p.theme.colors.gray400).alpha(0.1).toString()};
  }
`;

const StyledLink = styled(Link)`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;

  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;

const RightAligned = styled('span')`
  text-align: right;
`;
