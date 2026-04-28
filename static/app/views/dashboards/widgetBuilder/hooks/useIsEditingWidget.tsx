import {useParams} from 'sentry/utils/useParams';

export function useIsEditingWidget() {
  const {widgetIndex} = useParams();
  return widgetIndex !== undefined;
}
