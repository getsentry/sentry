import {useParams} from 'sentry/utils/useParams';

function useIsEditingWidget() {
  const {widgetIndex} = useParams();
  return widgetIndex !== undefined;
}

export default useIsEditingWidget;
