import Duration from 'sentry/components/duration/duration';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(Duration, story => {
  story('Default', () => (
    <ul>
      <li>
        One millisecond = <Duration duration={[1, 'ms']} precision="min" />
      </li>
      <li>
        One second = <Duration duration={[1, 'sec']} precision="min" />
      </li>
      <li>
        One minute = <Duration duration={[1, 'min']} precision="min" />
      </li>
      <li>
        One hour = <Duration duration={[1, 'hour']} precision="min" />
      </li>
      <li>
        One day = <Duration duration={[1, 'day']} precision="min" />
      </li>
      <li>
        One week = <Duration duration={[1, 'week']} precision="min" />
      </li>
    </ul>
  ));
});
