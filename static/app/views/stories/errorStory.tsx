import Alert from 'sentry/components/alert';

interface Props {
  error: Error;
}

export default function ErrorStory({error}: Props) {
  return (
    <Alert type="error" showIcon>
      <strong>{error.name}:</strong> {error.message}
    </Alert>
  );
}
