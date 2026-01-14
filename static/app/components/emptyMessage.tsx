import {useTheme} from '@emotion/react';
import {mergeProps} from '@react-aria/utils';

import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'color'> {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'lg' | 'md';
  title?: React.ReactNode;
}

function EmptyMessage({title, icon, children, action, size, ...props}: Props) {
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
            <IconDefaultsProvider size="xl">
              <Container color={theme.colors.gray500}>{icon}</Container>
            </IconDefaultsProvider>
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

export default EmptyMessage;
