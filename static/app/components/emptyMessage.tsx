import {useTheme} from '@emotion/react';
import {mergeProps} from '@react-aria/utils';

import {Container, Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'color'> {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'lg' | 'md';
  title?: React.ReactNode;
}

export function EmptyMessage({title, icon, children, action, size, ...props}: Props) {
  const theme = useTheme();

  return (
    <Flex gap="xl" direction="column" padding="3xl">
      {stackProps => (
        <Text
          align="center"
          size={size}
          data-test-id="empty-message"
          {...mergeProps(stackProps, props)}
        >
          {icon && (
            <SizeProvider size="xl">
              <Container color={theme.colors.gray500}>{icon}</Container>
            </SizeProvider>
          )}
          {title && (
            <Text bold size="xl" density="comfortable">
              {title}
            </Text>
          )}
          {children && (
            <Text textWrap="balance" density="comfortable">
              {children}
            </Text>
          )}
          {action && <Container paddingTop="xl">{action}</Container>}
        </Text>
      )}
    </Flex>
  );
}
