import {useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
}

export default function PreviewModalContainer({children, onClose}: Props) {
  const theme = useTheme();

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  return (
    <Wrapper>
      <Content>
        <Flex
          background="primary"
          height="100%"
          width="100%"
          padding="lg"
          border="primary"
          radius="lg"
          direction="column"
          gap="2xl"
        >
          <Flex justify="end">
            <Button
              priority="link"
              size="zero"
              borderless
              aria-label={t('Close Widget Builder')}
              icon={<IconClose size="sm" />}
              onClick={onClose}
              style={{color: theme.subText}}
            >
              {t('Close')}
            </Button>
          </Flex>
          {children}
        </Flex>
      </Content>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  height: 100vh;
  inset: 0;
  place-content: center;
  place-items: center;
  position: absolute;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
`;

const Content = styled('div')`
  width: 80%;
`;
