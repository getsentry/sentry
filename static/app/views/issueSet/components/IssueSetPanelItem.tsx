import styled from '@emotion/styled';

import Anchor from 'sentry/components/links/anchor';
import {Panel} from 'sentry/components/panels';
import PanelItem from 'sentry/components/panels/panelItem';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  issueSet: any;
  organization: Organization;
};

function IssueSetPanelItem({issueSet, organization}: Props) {
  const basePath = `/organizations/${organization.slug}/issues/sets/`;
  return (
    <PanelItem>
      <SetContainer>
        <SetTitle href={basePath.concat(issueSet.id)}>{issueSet.name}</SetTitle>
        {issueSet.items?.map(item => (
          <SetContents key={item.id}>{JSON.stringify(item)}</SetContents>
        ))}
      </SetContainer>
    </PanelItem>
  );
}

const SetContainer = styled('div')``;

export const SetTitle = styled(Anchor)`
  margin-bottom: ${space(0.5)};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;

export const SetContents = styled(Panel)`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(2)};
`;

export default IssueSetPanelItem;
