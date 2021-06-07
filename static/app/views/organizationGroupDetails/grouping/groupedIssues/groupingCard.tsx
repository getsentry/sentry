import styled from '@emotion/styled';

import Card from 'app/components/card';
import TextOverflow from 'app/components/textOverflow';
import {IconCheckmark} from 'app/icons';
import {t} from 'app/locale';
import {ChildFingerprint} from 'app/stores/groupingStore';
import space from 'app/styles/space';

type Props = {
  label: string;
  groupings: ChildFingerprint[];
  isActive: boolean;
  onClick?: () => void;
};

function GroupingCard({label, groupings, onClick, isActive}: Props) {
  return (
    <StyledCard interactive onClick={onClick} isActive={isActive}>
      <Header>
        <Label>
          {label}
          {isActive && <IconCheckmark size="md" isCircled color="purple300" />}
        </Label>
        <Description>{t('This is a description')}</Description>
      </Header>
      <Body>
        {groupings.map((grouping, index) => (
          <SubCard key={grouping.childId}>
            <strong>{t('Issue %s: ', index + 1)}</strong>
            {grouping.childId}
          </SubCard>
        ))}
      </Body>
    </StyledCard>
  );
}

export default GroupingCard;

const StyledCard = styled(Card)<{isActive: boolean}>`
  ${p =>
    p.isActive &&
    `
      &,
      &:focus,
      &:hover {
        box-shadow: 0px 0px 0px 6px rgba(108, 95, 199, 0.2);
      }
    `}
  ${p =>
    !p.onClick &&
    `
      * {
        cursor: not-allowed;
      }
    `};
  margin-bottom: -1px;
  overflow: hidden;
`;

const Header = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  display: grid;
  grid-gap: ${space(1)};
`;

const Body = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  height: 100%;
  margin-bottom: -1px;
`;

const Label = styled(TextOverflow)`
  height: 20px;
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 700;
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const SubCard = styled('div')`
  background: ${p => p.theme.bodyBackground};
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;
