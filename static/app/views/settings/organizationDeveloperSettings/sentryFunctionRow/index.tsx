import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconInput} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Organization, SentryFunction} from 'sentry/types';

import ActionButtons from '../sentryFunctionRow/actionButtons';

type Props = {
  onRemoveFunction: (org: Organization, sentryFn: SentryFunction) => void;
  organization: Organization;
  sentryFunction: SentryFunction;
};

export default function SentryFunctionRow(props: Props) {
  const {onRemoveFunction, organization, sentryFunction} = props;

  return (
    <SentryFunctionHolder>
      <StyledFlex>
        <IconInput size="xl" />
        <SentryFunctionBox>
          <SentryFunctionName>
            <Link
              to={`/settings/${organization.slug}/developer-settings/sentry-functions/${sentryFunction.slug}/`}
            >
              {sentryFunction.name}
            </Link>
          </SentryFunctionName>
        </SentryFunctionBox>
        <Box>
          <ActionButtons
            org={organization}
            sentryFn={sentryFunction}
            onDelete={onRemoveFunction}
          />
        </Box>
      </StyledFlex>
    </SentryFunctionHolder>
  );
}

const Flex = styled('div')`
  display: flex;
`;

const Box = styled('div')``;

const SentryFunctionHolder = styled(PanelItem)`
  flex-direction: column;
  padding: ${space(0.5)};
`;

const StyledFlex = styled(Flex)`
  justify-content: center;
  padding: ${space(1)};
`;

const SentryFunctionBox = styled('div')`
  padding: 0 15px;
  flex: 1;
`;

const SentryFunctionName = styled('div')`
  margin-top: 10px;
`;
