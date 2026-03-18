/**
 * Pruna Generation Hook (Refactored)
 * Clean React hook using new DDD architecture
 */

import { useState, useCallback, useRef } from 'react';
import { prunaService } from '../../application/services/pruna-service';
import type {
  PrunaImageGenerationRequest,
  PrunaVideoGenerationRequest,
  PrunaImageEditRequest,
  PrunaGenerationResponse,
  PrunaGenerationError,
} from '../../application/dto/pruna.dto';

export interface PrunaGenerationState {
  isGenerating: boolean;
  progress: number;
  status: string;
  error: PrunaGenerationError | null;
  result: PrunaGenerationResponse | null;
}

export function usePrunaGeneration() {
  const [state, setState] = useState<PrunaGenerationState>({
    isGenerating: false,
    progress: 0,
    status: 'idle',
    error: null,
    result: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const generateImage = useCallback(async (request: PrunaImageGenerationRequest) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({
      isGenerating: true,
      progress: 0,
      status: 'starting',
      error: null,
      result: null,
    });

    try {
      const response = await prunaService.generateImage(request, controller.signal);
      setState({
        isGenerating: false,
        progress: 100,
        status: 'completed',
        error: null,
        result: response,
      });
      return response;
    } catch (error) {
      const errorObj: PrunaGenerationError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
        originalError: error instanceof Error ? error.stack : undefined,
      };
      setState({
        isGenerating: false,
        progress: 0,
        status: 'error',
        error: errorObj,
        result: null,
      });
      throw error;
    }
  }, []);

  const generateVideo = useCallback(async (request: PrunaVideoGenerationRequest) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({
      isGenerating: true,
      progress: 0,
      status: 'starting',
      error: null,
      result: null,
    });

    try {
      const response = await prunaService.generateVideo(request, controller.signal);
      setState({
        isGenerating: false,
        progress: 100,
        status: 'completed',
        error: null,
        result: response,
      });
      return response;
    } catch (error) {
      const errorObj: PrunaGenerationError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
        originalError: error instanceof Error ? error.stack : undefined,
      };
      setState({
        isGenerating: false,
        progress: 0,
        status: 'error',
        error: errorObj,
        result: null,
      });
      throw error;
    }
  }, []);

  const generateImageEdit = useCallback(async (request: PrunaImageEditRequest) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({
      isGenerating: true,
      progress: 0,
      status: 'starting',
      error: null,
      result: null,
    });

    try {
      const response = await prunaService.generateImageEdit(request, controller.signal);
      setState({
        isGenerating: false,
        progress: 100,
        status: 'completed',
        error: null,
        result: response,
      });
      return response;
    } catch (error) {
      const errorObj: PrunaGenerationError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
        originalError: error instanceof Error ? error.stack : undefined,
      };
      setState({
        isGenerating: false,
        progress: 0,
        status: 'error',
        error: errorObj,
        result: null,
      });
      throw error;
    }
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(prev => ({
      ...prev,
      isGenerating: false,
      status: 'cancelled',
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      progress: 0,
      status: 'idle',
      error: null,
      result: null,
    });
  }, []);

  return {
    state,
    generateImage,
    generateVideo,
    generateImageEdit,
    cancel,
    reset,
  };
}
