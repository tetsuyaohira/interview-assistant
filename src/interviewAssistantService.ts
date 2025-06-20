import OpenAI from 'openai';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface InterviewResponse {
    success: boolean;
    response?: string;
    error?: string;
}

export class InterviewAssistantService extends EventEmitter {
    private openai: OpenAI | null = null;
    private profileContent: string = '';

    constructor() {
        super();
        this.loadProfileContent();
    }

    initialize(apiKey: string): void {
        console.log('Initializing OpenAI client for interview assistance...');
        this.openai = new OpenAI({
            apiKey: apiKey
        });
        console.log('OpenAI interview client initialized successfully');
    }

    private loadProfileContent(): void {
        try {
            const profilePath = path.join(process.cwd(), 'profile.md');
            if (fs.existsSync(profilePath)) {
                this.profileContent = fs.readFileSync(profilePath, 'utf8');
                console.log('Profile content loaded from profile.md');
            } else {
                console.warn('profile.md not found, using default profile');
                this.profileContent = this.getDefaultProfile();
            }
        } catch (error) {
            console.error('Error loading profile content:', error);
            this.profileContent = this.getDefaultProfile();
        }
    }

    private getDefaultProfile(): string {
        return `## 基本情報
- 名前: おおひらてつや
- 職種: Webアプリケーションエンジニア
- 経験: フルスタック開発（フロントエンド・バックエンド）
- 得意技術: Laravel、AWS
- 現在のプロジェクト: なっぷ（キャンプ場予約サイト）
- 在籍期間: 5年`;
    }

    async generateInterviewResponse(selectedText: string): Promise<InterviewResponse> {
        if (!this.openai) {
            return { success: false, error: 'OpenAI client not initialized' };
        }

        try {
            console.log('Generating interview response with OpenAI...');
            
            const prompt = this.createInterviewPrompt(selectedText);
            
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'あなたは面接対策の専門家です。与えられた個人情報と面接質問に基づいて、そのまま面接で話せる自然で丁寧な回答を生成してください。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 800,
                temperature: 0.7
            });

            const response = completion.choices[0]?.message?.content;
            
            if (response) {
                console.log('Interview response generated successfully');
                this.emit('responseGenerated', response);
                return { success: true, response: response.trim() };
            } else {
                return { success: false, error: 'Empty response from OpenAI' };
            }

        } catch (error) {
            console.error('Error generating interview response:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emit('error', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    private createInterviewPrompt(selectedText: string): string {
        return `# 面接回答生成依頼

## 応募者プロフィール
${this.profileContent}

## 面接での質問
"${selectedText}"

## 回答生成要件

### 【必須】言語・文体
- **敬語必須**: 必ず「です・ます調」の丁寧語
- **フォーマルな表現**: ビジネス面接にふさわしい正式な日本語
- **一人称は「私」**: 面接にふさわしい表現
- **自然な話し言葉**: 実際に口に出して話せる自然さ

### 【必須】回答形式
- **会話文のみ**: 面接で実際に話す内容だけを出力
- **説明や分析は不要**: 箇条書き、解説は含めない
- **適切な長さ**: 2-3分で話せる分量（300-500文字程度）
- **構成**: 結論→具体例→成果→学び→今後への活かし方

### 回答内容
- プロフィールの経験・スキルを具体的に活用
- 数字や成果を含める（可能であれば）
- 面接官が評価するポイントを押さえる
- 自信を持って話せる前向きな内容

### 出力例
「私が最も印象に残っているプロジェクトは、現在携わっておりますなっぷというキャンプ場予約サイトの開発です。このプロジェクトでは...」

**注意**: 純粋に面接で話す回答文のみを出力してください。分析や解説は一切不要です。`;
    }

    isInitialized(): boolean {
        return this.openai !== null;
    }
}