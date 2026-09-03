import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Composer, type ComposerValue} from '@sentry/scraps/composer';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {IconMarkdown} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import {useOrgMentionSources} from 'sentry/utils/mentions/useOrgMentionSources';

interface CreateComposerProps {
  onSubmit: (data: NoteType) => Promise<void>;
  initialValue?: string;
  minHeight?: number;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  variant?: 'compact' | 'full';
}

interface EditComposerProps {
  initialValue: string;
  onCancel: () => void;
  onSubmit: (data: NoteType) => Promise<void>;
  minHeight?: number;
  placeholder?: string;
  variant?: 'compact' | 'full';
}

type MentionComposerProps =
  | ({mode: 'create'} & CreateComposerProps)
  | ({mode: 'edit'} & EditComposerProps);

type EditorMode = 'write' | 'preview';

function serializeNoteMentions(value: ComposerValue): string {
  let text = value.text;

  for (const mention of value.mentions.toSorted((a, b) => b.start - a.start)) {
    if (value.text.slice(mention.start, mention.end) !== mention.text) {
      continue;
    }

    text = text.slice(0, mention.start) + `**${mention.text}**` + text.slice(mention.end);
  }

  return text;
}

export function MentionComposer(props: MentionComposerProps) {
  const {
    initialValue = '',
    minHeight = 140,
    onSubmit,
    placeholder = t('Add a comment.\nTag users or teams with @'),
    variant = 'full',
  } = props;
  const sources = useOrgMentionSources();
  const isEditing = props.mode === 'edit';
  const [editorMode, setEditorMode] = useState<EditorMode>('write');
  const [hasFocusedEditor, setHasFocusedEditor] = useState(isEditing);
  const initialEditorValue: ComposerValue = {text: initialValue, mentions: []};
  const isCompact = variant === 'compact';

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      value: initialEditorValue,
    },
    onSubmit: async ({value}) => {
      const editorValue = value.value;
      const validMentionIds = editorValue.mentions.flatMap(mention =>
        editorValue.text.slice(mention.start, mention.end) === mention.text
          ? mention.id
          : []
      );
      const uniqueMentionIds = [...new Set(validMentionIds)];
      const data = {
        text: serializeNoteMentions(editorValue),
        mentions: uniqueMentionIds,
      };

      await onSubmit(data);

      if (props.mode === 'create') {
        form.reset(
          {value: {text: '', mentions: []}},
          {
            // Prevent a saved draft from being restored after reset.
            keepDefaultValues: true,
          }
        );
        setEditorMode('write');
        setHasFocusedEditor(false);
      }
    },
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="value">
        {field =>
          editorMode === 'write' || isCompact ? (
            <field.Base<HTMLDivElement>>
              {({ref, ...fieldProps}) => (
                <Composer
                  {...fieldProps}
                  ref={ref}
                  aria-label={isEditing ? t('Edit comment') : t('Add a comment')}
                  sources={sources}
                  placeholder={placeholder}
                  onChange={nextValue => {
                    field.handleChange(nextValue);
                    if (props.mode === 'create') {
                      props.onValueChange?.(nextValue.text);
                    }
                  }}
                  onFocus={() => setHasFocusedEditor(true)}
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' &&
                      (event.metaKey || event.ctrlKey) &&
                      field.state.value.text.trim() !== ''
                    ) {
                      event.preventDefault();
                      form.handleSubmit();
                    }
                  }}
                  value={field.state.value}
                  minHeight={isCompact ? undefined : minHeight}
                  size={isCompact ? 'sm' : undefined}
                />
              )}
            </field.Base>
          ) : (
            <Container
              background="primary"
              border="primary"
              radius="md"
              padding="lg"
              maxHeight="1000px"
              maxWidth="100%"
              minHeight={`${minHeight}px`}
              overflow="auto"
            >
              <Markdown raw={serializeNoteMentions(field.state.value)} />
            </Container>
          )
        }
      </form.AppField>
      {hasFocusedEditor && (
        <Flex
          align="center"
          justify={isCompact ? 'end' : 'between'}
          gap="md"
          paddingTop="sm"
        >
          {!isCompact && (
            <EditorControls
              isEditing={isEditing}
              mode={editorMode}
              onModeChange={setEditorMode}
            />
          )}
          <Flex align="center" gap="sm">
            {props.mode === 'edit' && (
              <form.Subscribe selector={state => state.isSubmitting}>
                {isSubmitting => (
                  <Button size="xs" onClick={props.onCancel} disabled={isSubmitting}>
                    {t('Cancel')}
                  </Button>
                )}
              </form.Subscribe>
            )}
            <form.Subscribe selector={state => state.values.value.text.trim() === ''}>
              {isEmpty => (
                <form.SubmitButton
                  size="xs"
                  disabled={isEmpty}
                  aria-label={
                    isEditing
                      ? t('Save comment')
                      : isCompact
                        ? t('Submit comment')
                        : undefined
                  }
                >
                  {isEditing ? t('Save') : t('Comment')}
                </form.SubmitButton>
              )}
            </form.Subscribe>
          </Flex>
        </Flex>
      )}
    </form.AppForm>
  );
}

function EditorControls({
  isEditing,
  mode,
  onModeChange,
}: {
  isEditing: boolean;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}) {
  return (
    <Flex align="center" gap="md">
      <SegmentedControl<EditorMode>
        aria-label={t('Comment editor mode')}
        size="xs"
        value={mode}
        onChange={onModeChange}
      >
        <SegmentedControl.Item key="write">
          {isEditing ? t('Edit') : t('Write')}
        </SegmentedControl.Item>
        <SegmentedControl.Item key="preview">{t('Preview')}</SegmentedControl.Item>
      </SegmentedControl>
      <Flex as="span" align="center" gap="xs" display={{zero: 'none', sm: 'inline-flex'}}>
        <IconMarkdown size="sm" variant="muted" />
        <Text as="span" size="sm" variant="muted">
          {t('Markdown supported')}
        </Text>
      </Flex>
    </Flex>
  );
}
