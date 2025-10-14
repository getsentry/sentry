import {useTheme} from '@emotion/react';
import color from 'color';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {TextArea} from '@sentry/scraps/textarea';

import testableTransition from 'sentry/utils/testableTransition';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

interface AIChatProps {
  onClose: () => void;
  onSubmit: (message: string) => void;
}

export function AIChat({onClose, onSubmit}: AIChatProps) {
  const theme = useTheme();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get('message') as string;
    onSubmit(message);
  };

  return (
    <motion.div {...PANEL_TRANSITION}>
      <Container
        data-inspector-skip
        position="fixed"
        width="100%"
        maxWidth="560px"
        padding="lg"
        radius="md"
        border="primary"
        style={{
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          backdropFilter: 'blur(10px)',
          backgroundColor: isChonkTheme(theme)
            ? color(theme.tokens.background.primary).alpha(ALPHA).toString()
            : color(theme.background).alpha(ALPHA).toString(),
        }}
      >
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="lg">
            <Container background="primary" radius="md">
              <TextArea
                rows={3}
                placeholder="You can just do things..."
                autosize
                style={{
                  minBlockSize: '4lh !important',
                  minInlineSize: '4lh !important',
                  backgroundColor: isChonkTheme(theme)
                    ? theme.tokens.background.primary
                    : theme.background,
                }}
              />
            </Container>
            <Flex direction="row" gap="sm" justify="between">
              <Button priority="default" type="button" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button priority="primary" type="submit" size="sm">
                Send
              </Button>
            </Flex>
          </Flex>
        </form>
      </Container>
    </motion.div>
  );
}

const ALPHA = 0.65;

const PANEL_TRANSITION = {
  initial: {opacity: 0, y: 70},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 70},
  transition: testableTransition({
    type: 'spring',
    stiffness: 450,
    damping: 25,
  }),
};
