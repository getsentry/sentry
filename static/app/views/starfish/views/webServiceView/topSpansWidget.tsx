import {useQuery} from 'sentry/utils/queryClient';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getTopSpansInModule} from 'sentry/views/starfish/views/webServiceView/queries';

type Props = {
  module?: string;
};

export default function TopSpansWidget({module}: Props) {
  const {isLoading: isTopSpansDataLoading, data: topSpansData} = useQuery({
    queryKey: ['topSpans', module],
    queryFn: () =>
      fetch(`${HOST}/?query=${getTopSpansInModule(module)}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  if (!isTopSpansDataLoading) {
    console.dir(topSpansData);
  }

  return <div />;
}
