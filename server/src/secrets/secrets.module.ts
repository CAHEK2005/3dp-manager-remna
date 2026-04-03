import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../settings/entities/setting.entity';
import { SecretsService } from './secrets.service';
import { SecretsController } from './secrets.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [SecretsService],
  controllers: [SecretsController],
  exports: [SecretsService],
})
export class SecretsModule {}
