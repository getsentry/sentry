import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClose, IconExclamation} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isNotFoundError} from 'sentry/utils/requestError/requestError';
import {useAuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

interface OrganizationSlugInputProps {
  onCancel: () => void;
  onSelect: (organizationSlug: string) => void;
}

export function OrganizationSlugInput({onCancel, onSelect}: OrganizationSlugInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorDescriptionId = useId();
  const [slug, setSlug] = useState('');
  const [submittedSlug, setSubmittedSlug] = useState<string>();
  const normalizedSlug = slug.trim();
  const organizationQuery = useAuthOrganization(submittedSlug);
  const hasError = Boolean(submittedSlug && organizationQuery.isError);
  const isLocating =
    organizationQuery.isFetching || Boolean(submittedSlug && organizationQuery.isSuccess);
  const organizationNotFound = hasError && isNotFoundError(organizationQuery.error);
  const errorMessage = hasError
    ? organizationNotFound
      ? t('Organization not found')
      : t('Unable to load organization authentication. Please try again.')
    : null;

  useEffect(() => {
    if (
      !submittedSlug ||
      !organizationQuery.data ||
      organizationQuery.isFetching ||
      organizationQuery.isError
    ) {
      return;
    }

    onSelect(submittedSlug);
  }, [
    onSelect,
    organizationQuery.data,
    organizationQuery.isError,
    organizationQuery.isFetching,
    submittedSlug,
  ]);

  useLayoutEffect(() => {
    if (!submittedSlug || !organizationQuery.error) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [organizationQuery.error, submittedSlug]);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();

        if (!normalizedSlug) {
          return;
        }

        if (organizationNotFound) {
          return;
        }

        if (submittedSlug === normalizedSlug && organizationQuery.isError) {
          void organizationQuery.refetch();
          return;
        }

        setSubmittedSlug(normalizedSlug);
      }}
    >
      <InputGroup>
        <InputGroup.Input
          ref={inputRef}
          aria-describedby={errorMessage ? errorDescriptionId : undefined}
          aria-label={t('Organization Slug')}
          autoCapitalize="none"
          autoComplete="off"
          autoFocus
          data-1p-ignore
          placeholder={t('Organization Slug')}
          readOnly={isLocating}
          spellCheck={false}
          value={slug}
          aria-invalid={hasError}
          onChange={event => {
            const nextSlug = event.currentTarget.value;
            setSlug(nextSlug);

            if (submittedSlug && nextSlug.trim() !== submittedSlug) {
              setSubmittedSlug(undefined);
            }
          }}
        />
        <InputGroup.TrailingItems>
          {errorMessage ? (
            <Tooltip forceVisible skipWrapper title={errorMessage}>
              <IconExclamation aria-hidden size="sm" variant="danger" />
            </Tooltip>
          ) : null}
          {!organizationNotFound && normalizedSlug ? (
            <Button busy={isLocating} size="zero" type="submit" variant="transparent">
              {t('Locate')}
            </Button>
          ) : null}
          <Button
            aria-label={t('Cancel organization SSO')}
            icon={<IconClose />}
            size="zero"
            tooltipProps={{title: t('Cancel organization SSO')}}
            variant="transparent"
            onClick={onCancel}
          />
        </InputGroup.TrailingItems>
      </InputGroup>
      {errorMessage && (
        <VisuallyHidden id={errorDescriptionId} role="alert">
          {errorMessage}
        </VisuallyHidden>
      )}
    </form>
  );
}
