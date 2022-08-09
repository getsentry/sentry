import {Link} from 'react-router';
import styled from '@emotion/styled';

import {PanelItem} from 'sentry/components/panels';
import {IconInput} from 'sentry/icons';
import space from 'sentry/styles/space';
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
      <StyledIconInput />
      <LinkWrapper>
        <StyledLink
          to={`/settings/${organization.slug}/developer-settings/sentry-functions/${sentryFunction.slug}/`}
        >
          {sentryFunction.name}
        </StyledLink>
      </LinkWrapper>
      <Box>
        <SentryFunctionRowButtons
          org={organization}
          sentryFn={sentryFunction}
          onClickRemove={onRemoveFunction}
        />
      </Box>
    </SentryFunctionHolder>
  );
}

const Box = styled('div')`
  margin-left: auto;
  margin-right: 5px;
`;

const SentryFunctionHolder = styled(PanelItem)`
  display: flex;
  flex-direction: row;
  padding: 10px;
`;

const StyledIconInput = styled(IconInput)`
  height: 36px;
  width: 36px;
`;

const LinkWrapper = styled('div')`
  padding-left: ${space(1)};
  display: flex;
`;

const StyledLink = styled(Link)`
  margin: auto;
  padding: 5px;
`;
