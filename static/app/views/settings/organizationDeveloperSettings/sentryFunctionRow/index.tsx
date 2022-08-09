import {Link} from 'react-router';
import styled from '@emotion/styled';

import {PanelItem} from 'sentry/components/panels';
import {IconInput} from 'sentry/icons';
import {Organization, SentryFunction} from 'sentry/types';

import SentryFunctionRowButtons from './sentryFunctionRowButtons';

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
        <StyledIconInput />
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
          <SentryFunctionRowButtons
            org={organization}
            sentryFn={sentryFunction}
            onClickRemove={onRemoveFunction}
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
  padding: 5px;
`;

const StyledFlex = styled(Flex)`
  justify-content: center;
  padding: 10px;
`;

const SentryFunctionBox = styled('div')`
  padding-left: 15px;
  padding-right: 15px;
  flex: 1;
`;

const StyledIconInput = styled(IconInput)`
  height: 36px;
  width: 36px;
`;

const SentryFunctionName = styled('div')`
  margin-top: 10px;
`;
