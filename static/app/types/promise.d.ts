interface Promise<T> {
  then<TFul = T, TRej = never>(
    onfulfilled?: ((value: T) => TFul | PromiseLike<TFul>) | null,
    onrejected?: ((reason: unknown) => TRej | PromiseLike<TRej>) | null
  ): Promise<TFul | TRej>;

  catch<TRej = never>(
    onrejected?: ((reason: unknown) => TRej | PromiseLike<TRej>) | null
  ): Promise<T | TRej>;
}
