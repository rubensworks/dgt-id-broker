import { of, Observable, throwError } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '@digita-ai/handlersjs-http';
import { KeyValueStore } from '../storage/key-value-store';
import { createErrorResponse } from '../util/error-response-factory';
import { Code, ChallengeAndMethod } from '../util/code-challenge-method';
import { PkceCodeRequestHandler } from './pkce-code-request.handler';

/**
 * A {HttpHandler} that handles pkce requests to the authorization endpoint.
 */
export class PkceAuthRequestHandler extends HttpHandler {

  /**
   * Creates a {PkceAuthRequestHandler}
   *
   * @param {PkceCodeRequestHandler} codeHandler - the handler that will handle the response from the upstream server containing a code.
   * @param {KeyValueStore<Code, ChallengeAndMethod>}  store - stores the challenge method, code challenge, and wether or not the user sent state.
   */
  constructor(
    private codeHandler: PkceCodeRequestHandler,
    private store: KeyValueStore<Code, ChallengeAndMethod>,
  ){

    super();

    if (!codeHandler) {

      throw new Error('A HttpHandler must be provided');

    }

    if (!store) {

      throw new Error('A store must be provided');

    }

  }
  /**
   * Handles the given context. Takes the code challenge, challenge method, and, if present, the state from the request.
   * The store then saves the code challenge, challenge method and wether or not the user sent a state as the value,
   * and the state as the key. If the user does not send a state in the request, one will be generated and put in the request to connect the code
   * that is sent by the server and this request.
   * The parameters code_challenge and challenge_method are then removed from the request so that it becomes a PKCE-less request.
   *
   * @param {HttpHandlerContext} context
   */
  handle(context: HttpHandlerContext): Observable<HttpHandlerResponse> {

    if (!context) {

      return throwError(new Error('Context cannot be null or undefined'));

    }

    if (!context.request) {

      return throwError(new Error('No request was included in the context'));

    }

    if (!context.request.url) {

      return throwError(new Error('No url was included in the request'));

    }

    const challenge = context.request.url.searchParams.get('code_challenge');
    const method = context.request.url.searchParams.get('code_challenge_method');
    const state = context.request.url.searchParams.get('state');

    if (!challenge) {

      return of(createErrorResponse('A code challenge must be provided.', 'invalid_request'));

    }

    if (!method) {

      return of(createErrorResponse('A code challenge method must be provided', 'invalid_request'));

    }

    const generatedState = state ? '' : uuidv4();

    if (generatedState) {

      context.request.url.searchParams.append('state', generatedState);

    }

    this.store.set(state ?? generatedState, { challenge, method, initialState: !!state });

    context.request.url.searchParams.delete('code_challenge');
    context.request.url.searchParams.delete('code_challenge_method');

    return this.codeHandler.handle(context);

  }

  /**
   * Returns true if the context is valid.
   * Returns false if the context, it's request, or the request's method, headers, or url are not included.
   *
   * @param {HttpHandlerContext} context
   */
  canHandle(context: HttpHandlerContext): Observable<boolean> {

    return context
      && context.request
      && context.request.url
      && context.request.url.searchParams.get('code_challenge')
      && context.request.url.searchParams.get('code_challenge_method')
      ? of(true)
      : of(false);

  }

}