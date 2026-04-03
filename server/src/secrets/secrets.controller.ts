import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpException, HttpStatus,
} from '@nestjs/common';
import { SecretsService } from './secrets.service';

@Controller('secrets')
export class SecretsController {
  constructor(private secretsService: SecretsService) {}

  @Get()
  getAll() {
    return this.secretsService.getAll();
  }

  @Get(':id/value')
  async getValue(@Param('id') id: string) {
    const value = await this.secretsService.getValue(id);
    if (value === null) throw new HttpException('Secret not found', HttpStatus.NOT_FOUND);
    return { value };
  }

  @Post()
  create(@Body() body: { name: string; type: string; value: string; description?: string }) {
    if (!body.name?.trim() || !body.value?.trim()) {
      throw new HttpException('name and value required', HttpStatus.BAD_REQUEST);
    }
    return this.secretsService.create(body as any);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    try {
      await this.secretsService.update(id, body);
    } catch {
      throw new HttpException('Secret not found', HttpStatus.NOT_FOUND);
    }
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.secretsService.delete(id);
  }
}
