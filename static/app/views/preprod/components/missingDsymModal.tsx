import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface MissingDsymModalProps {
  binaries: string[];
  closeModal: () => void;
}

function MissingDsymModal({binaries, closeModal}: MissingDsymModalProps) {
  return (
    <Flex direction="column" gap="lg">
      <Flex justify="center" align="center" width="100%" position="relative">
        <Heading as="h2">
          {tn('Missing Debug Symbol', 'Missing Debug Symbols', binaries.length)}
        </Heading>
        <Container
          position="absolute"
          style={{top: '50%', right: 0, transform: 'translateY(-50%)'}}
        >
          <Button
            onClick={closeModal}
            priority="transparent"
            icon={<IconClose />}
            size="sm"
            aria-label={t('Close')}
          />
        </Container>
      </Flex>

      <Text>
        {t(
          'The following binaries are missing debug symbols. Those binaries will not have a detailed breakdown in the size analysis.'
        )}
      </Text>

      <BinaryList gap="xs">
        {binaries.map(binary => (
          <BinaryItem key={binary}>
            <Text size="sm">{binary}</Text>
          </BinaryItem>
        ))}
      </BinaryList>
    </Flex>
  );
}

const BinaryList = styled(Stack)`
  max-height: 400px;
  overflow-y: auto;
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.border};
`;

const BinaryItem = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.border};

  code {
    font-family: ${p => p.theme.text.familyMono};
    word-break: break-all;
  }
`;

export function openMissingDsymModal(binaries: string[]) {
  openModal(
    ({closeModal}) => <MissingDsymModal binaries={binaries} closeModal={closeModal} />,
    {
      modalCss: css`
        max-width: 600px;
      `,
    }
  );
}
