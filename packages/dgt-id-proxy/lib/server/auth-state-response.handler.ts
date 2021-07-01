import { Handler } from '@digita-ai/handlersjs-core';
import { HttpHandlerResponse } from '@digita-ai/handlersjs-http';
import { of, from, throwError, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { KeyValueStore } from '../storage/key-value-store';

/**
 * A { Handler<HttpHandlerResponse, HttpHandlerResponse> } that handles the response from the upstream
 * Authorization Endpoint that contains a state.
 */
export class AuthStateResponseHandler extends Handler<HttpHandlerResponse, HttpHandlerResponse> {

  /**
   * creates an { AuthStateResponseHandler }
   *
   * @param {KeyValueStore<string, boolean>} keyValueStore - store with state as key and a boolean that is
   * true if the client sent the state originally, and false if it was generated by the proxy
   */
  constructor(private keyValueStore: KeyValueStore<string, boolean>) {

    super();

    if(!keyValueStore){

      throw new Error('A keyValueStore must be provided');

    }

  }

  /**
   * handles the response by checking if the location header contains a valid URL. If it does,
   * it checks the state on the url, finds it in its store, and checks if the client sent the
   * state originally. If the client sent the state, the response is returned to the client as is.
   * If the client did not send the state the response is returned with the state removed from
   * the location header.
   * If the location header is not a valid URL (relative URL for example) the response is
   * returned unchanged.
   * If the state is not found in the location header, or the state is not found in the
   * keyValueStore an error is thrown
   *
   * @param {HttpHandlerResponse} response
   */
  handle(response: HttpHandlerResponse): Observable<HttpHandlerResponse> {

    if (!response) {

      return throwError(new Error('Response cannot be null or undefined'));

    }

    try {

      const url = new URL(response.headers.location);
      const state = url.searchParams.get('state') ?? '';

      return from(this.keyValueStore.get(state)).pipe(
        switchMap((clientSentState) => {

          if (clientSentState === undefined) {

            return throwError(new Error('Unknown state'));

          }

          if (!clientSentState) {

            url.searchParams.delete('state');
            response.headers.location = url.toString();

          }

          this.keyValueStore.delete(state);

          return of(response);

        })
      );

    } catch (error) {

      return of(response);

    }

  }

  /**
   * Specifies that if the response is defined this handler can handle the response.
   *
   * @param {HttpHandlerResponse} response
   */
  canHandle(response: HttpHandlerResponse): Observable<boolean> {

    return response
      ? of(true)
      : of(false);

  }

}