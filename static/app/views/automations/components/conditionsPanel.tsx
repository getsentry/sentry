import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type ConditionsPanelProps = {
  actions: string[];
  if_conditions: string[];
  when_conditions: string[];
};

function List(list: string[]) {
  return list.map((item, index) => <ListItem key={index}>{item}</ListItem>);
}

function ConditionsPanel({
  actions,
  if_conditions,
  when_conditions,
}: ConditionsPanelProps) {
  return (
    <Panel column gap={space(2)}>
      <Flex column gap={space(1)}>
        <div>
          {tct('[when:When] any of the following occur', {
            when: <Badge />,
          })}
        </div>
        {List(when_conditions)}
      </Flex>
      {if_conditions.length > 0 && (
        <Flex column gap={space(1)}>
          <div>
            {tct('[if:If] any of these filters match', {
              if: <Badge />,
            })}
          </div>
          {List(if_conditions)}
        </Flex>
      )}
      <Flex column gap={space(1)}>
        <div>
          {tct('[then:Then] perform these actions', {
            then: <Badge />,
          })}
        </div>
        {List(actions)}
      </Flex>
    </Panel>
  );
}

const Panel = styled(Flex)`
  background-color: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.translucentBorder};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
`;

const Badge = styled('span')`
  display: inline-block;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.5;
`;

const ListItem = styled('span')`
  color: ${p => p.theme.subText};
`;

export default ConditionsPanel;
