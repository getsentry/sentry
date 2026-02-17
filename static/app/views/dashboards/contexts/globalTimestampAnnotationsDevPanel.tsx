import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconClose} from 'sentry/icons';

import {useGlobalTimestampAnnotationsContext} from './globalTimestampAnnotationsContext';

export function GlobalTimestampAnnotationsDevPanel() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return <DevPanelInner />;
}

function DevPanelInner() {
  const [isOpen, setIsOpen] = useState(false);
  const [timestampInput, setTimestampInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const {annotations, addAnnotation, removeAnnotation, clearAnnotations} =
    useGlobalTimestampAnnotationsContext();

  function handleAdd() {
    const timestamp = timestampInput ? new Date(timestampInput).getTime() : Date.now();
    if (isNaN(timestamp)) {
      return;
    }
    addAnnotation({
      timestamp,
      label: labelInput || undefined,
    });
    setTimestampInput('');
    setLabelInput('');
  }

  if (!isOpen) {
    return (
      <FloatingButton size="sm" onClick={() => setIsOpen(true)}>
        Annotations ({annotations.length})
      </FloatingButton>
    );
  }

  return (
    <FloatingPanel>
      <PanelHeader>
        <strong>Timestamp Annotations</strong>
        <Button
          size="sm"
          priority="transparent"
          icon={<IconClose size="xs" />}
          aria-label="Close"
          onClick={() => setIsOpen(false)}
        />
      </PanelHeader>
      <PanelBody>
        {annotations.length === 0 ? (
          <EmptyState>No annotations</EmptyState>
        ) : (
          <AnnotationList>
            {annotations.map((annotation, index) => (
              <AnnotationItem key={index}>
                <AnnotationInfo>
                  <span>{new Date(annotation.timestamp).toLocaleTimeString()}</span>
                  {annotation.label && (
                    <AnnotationLabel>{annotation.label}</AnnotationLabel>
                  )}
                </AnnotationInfo>
                <Button
                  size="sm"
                  priority="transparent"
                  icon={<IconClose size="xs" />}
                  aria-label="Remove annotation"
                  onClick={() => removeAnnotation(index)}
                />
              </AnnotationItem>
            ))}
          </AnnotationList>
        )}
        <InputGroup>
          <Input
            type="datetime-local"
            value={timestampInput}
            onChange={e => setTimestampInput(e.target.value)}
            placeholder="Timestamp (empty = now)"
            step="1"
          />
          <Input
            type="text"
            value={labelInput}
            onChange={e => setLabelInput(e.target.value)}
            placeholder="Label (optional)"
          />
        </InputGroup>
        <PanelActions>
          <Button size="sm" onClick={handleAdd}>
            {timestampInput ? 'Add' : 'Add Now'}
          </Button>
          <Button
            size="sm"
            onClick={clearAnnotations}
            disabled={annotations.length === 0}
          >
            Clear All
          </Button>
        </PanelActions>
      </PanelBody>
    </FloatingPanel>
  );
}

const FloatingButton = styled(Button)`
  position: fixed;
  bottom: ${p => p.theme.space.lg};
  left: ${p => p.theme.space.lg};
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const FloatingPanel = styled('div')`
  position: fixed;
  bottom: ${p => p.theme.space.lg};
  left: ${p => p.theme.space.lg};
  z-index: ${p => p.theme.zIndex.tooltip};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  width: 280px;
`;

const PanelHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const PanelBody = styled('div')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
`;

const EmptyState = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  padding: ${p => p.theme.space.sm} 0;
`;

const AnnotationList = styled('div')`
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: ${p => p.theme.space.sm};
`;

const AnnotationItem = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${p => p.theme.space.xs} 0;
  font-size: ${p => p.theme.font.size.sm};
`;

const AnnotationInfo = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AnnotationLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.xs};
`;

const InputGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  margin-bottom: ${p => p.theme.space.sm};
`;

const Input = styled('input')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  width: 100%;
`;

const PanelActions = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
`;
