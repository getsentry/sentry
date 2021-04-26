import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import Button from 'app/components/button';
import {IconEdit, IconLock} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  data: Record<string, any>;
  onDelete: () => void;
};

function Card({data, onDelete}: Props) {
  return (
    <Wrapper>
      <IconWrapper>
        <IconLock size="lg" />
      </IconWrapper>
      <Content>
        {Object.entries(data).map(([key, value]) => {
          if (!value) {
            return undefined;
          }

          const label = key
            .split(/(?<=[a-z])(?=[A-Z])/)
            .map(splittedKey => capitalize(splittedKey))
            .join(' ');

          return (
            <ContentItem key={key}>
              <strong>{`${label}:`}</strong>
              <span>{value}</span>
            </ContentItem>
          );
        })}
      </Content>
      <div>
        <Button icon={<IconEdit />} label={t('Edit')} size="small" onClick={onDelete} />
      </div>
    </Wrapper>
  );
}

export default Card;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-gap: ${space(1)};
`;

const Content = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${space(1.5)};
`;

const ContentItem = styled(Wrapper)`
  font-size: ${p => p.theme.fontSizeMedium};
`;
