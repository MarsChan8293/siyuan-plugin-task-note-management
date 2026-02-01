import { Person } from '../types/person';

interface ReminderItem {
    assigneeId?: string;
}

interface Project {
    assigneeId?: string;
}

const DEFAULT_PERSONS: Person[] = [];

export class PersonManager {
    private static instance: PersonManager;
    private persons: Person[] = [];
    private plugin: any;

    private constructor(plugin: any) {
        this.plugin = plugin;
    }

    public static getInstance(plugin?: any): PersonManager {
        if (!PersonManager.instance) {
            if (!plugin) {
                throw new Error('PersonManager需要plugin实例进行初始化');
            }
            PersonManager.instance = new PersonManager(plugin);
        }
        return PersonManager.instance;
    }

    public async initialize(): Promise<void> {
        try {
            await this.loadPersons();
        } catch (error) {
            console.error('初始化责任人失败:', error);
            this.persons = [...DEFAULT_PERSONS];
            await this.savePersons();
        }
    }

    public async loadPersons(): Promise<Person[]> {
        try {
            const content = await this.plugin.loadPersonsData();
            if (!content) {
                console.log('责任人文件不存在，创建默认列表');
                this.persons = [...DEFAULT_PERSONS];
                await this.savePersons();
                return this.persons;
            }

            const personsData = content;

            if (Array.isArray(personsData) && personsData.length > 0) {
                this.persons = personsData;
            } else {
                console.log('责任人数据无效，使用默认列表');
                this.persons = [...DEFAULT_PERSONS];
                await this.savePersons();
            }
        } catch (error) {
            console.warn('加载责任人文件失败，使用默认列表:', error);
            this.persons = [...DEFAULT_PERSONS];
            await this.savePersons();
        }

        return this.persons;
    }

    public async savePersons(): Promise<void> {
        try {
            await this.plugin.savePersonsData(this.persons);
            window.dispatchEvent(new CustomEvent('personUpdated'));
        } catch (error) {
            console.error('保存责任人失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有责任人
     * @returns 责任人数组的副本
     */
    public getPersons(): Person[] {
        return [...this.persons];
    }

    /**
     * 根据ID获取责任人
     * @param id 责任人ID
     * @returns 责任人对象或undefined
     */
    public getPersonById(id: string): Person | undefined {
        return this.persons.find(p => p.id === id);
    }

    /**
     * 获取责任人姓名
     * @param id 责任人ID
     * @returns 责任人姓名或undefined
     */
    public getPersonName(id: string): string | undefined {
        const person = this.getPersonById(id);
        return person?.name;
    }

    /**
     * 检查姓名是否重复
     * @param name 要检查的姓名
     * @returns 是否重复
     */
    private isNameDuplicate(name: string): boolean {
        return this.persons.some(person => 
            person.name.toLowerCase() === name.toLowerCase()
        );
    }

    /**
     * 添加新责任人
     * @param name 责任人姓名
     * @returns 新创建的责任人对象
     * @throws 如果姓名为空、超过100字符或已存在
     */
    public async addPerson(name: string): Promise<Person> {
        const trimmedName = name.trim();
        
        if (trimmedName.length === 0) {
            throw new Error('责任人姓名不能为空');
        }
        
        if (trimmedName.length > 100) {
            throw new Error('责任人姓名不能超过100个字符');
        }
        
        if (this.isNameDuplicate(trimmedName)) {
            throw new Error('责任人姓名已存在');
        }

        const newPerson: Person = {
            id: `person_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            name: trimmedName,
            createdAt: new Date().toISOString()
        };

        this.persons.push(newPerson);
        await this.savePersons();
        return newPerson;
    }

    /**
     * 更新责任人
     * @param id 责任人ID

     * @param updates 要更新的字段
     * @throws 如果责任人不存在、姓名为空、超过100字符或已存在
     */
    public async updatePerson(id: string, updates: Partial<Omit<Person, 'id' | 'createdAt'>>): Promise<void> {
        const index = this.persons.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error('责任人不存在');
        }

        if (updates.name !== undefined) {
            const trimmedName = updates.name.trim();
            
            if (trimmedName.length === 0) {
                throw new Error('责任人姓名不能为空');
            }
            
            if (trimmedName.length > 100) {
                throw new Error('责任人姓名不能超过100个字符');
            }
            
            const isDuplicate = this.persons.some((person, idx) => 
                idx !== index && person.name.toLowerCase() === trimmedName.toLowerCase()
            );
            
            if (isDuplicate) {
                throw new Error('责任人姓名已存在');
            }
            
            updates.name = trimmedName;
        }

        this.persons[index] = { ...this.persons[index], ...updates };
        await this.savePersons();
    }

    /**
     * 删除责任人
     * @param id 责任人ID
     * @throws 如果责任人不存在
     */
    public async deletePerson(id: string): Promise<void> {
        const index = this.persons.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error('责任人不存在');
        }

        this.persons.splice(index, 1);
        await this.savePersons();
    }

    /**
     * 重排序责任人
     * @param reorderedPersons 重排序后的责任人列表
     * @throws 如果数组无效或ID不匹配
     */
    public async reorderPersons(reorderedPersons: Person[]): Promise<void> {
        if (!Array.isArray(reorderedPersons)) {
            throw new Error('重排序的责任人必须是数组');
        }

        if (reorderedPersons.length !== this.persons.length) {
            throw new Error('重排序的责任人数量不匹配');
        }

        const currentIds = new Set(this.persons.map(p => p.id));
        const reorderedIds = new Set(reorderedPersons.map(p => p.id));

        if (currentIds.size !== reorderedIds.size ||
            ![...currentIds].every(id => reorderedIds.has(id))) {
            throw new Error('重排序的责任人ID不匹配');
        }

        this.persons = [...reorderedPersons];
        await this.savePersons();
    }

    /**
     * 检查责任人是否在使用中
     * @param personId 责任人ID
     * @returns 使用情况统计
     */
    public async checkPersonInUse(personId: string): Promise<{ inUse: boolean, tasksCount: number, projectsCount: number }> {
        try {
            const reminderData = await this.plugin.loadReminderData();
            const projectData = await this.plugin.loadProjectData();

            let tasksCount = 0;
            let projectsCount = 0;

            for (const [id, reminder] of Object.entries(reminderData || {})) {
                if (id.startsWith('_')) continue;
                if ((reminder as ReminderItem).assigneeId === personId) {
                    tasksCount++;
                }
            }

            for (const [id, project] of Object.entries(projectData || {})) {
                if (id.startsWith('_')) continue;
                if ((project as Project).assigneeId === personId) {
                    projectsCount++;
                }
            }

            return {
                inUse: tasksCount > 0 || projectsCount > 0,
                tasksCount,
                projectsCount
            };
        } catch (error) {
            console.error('检查责任人使用情况失败:', error);
            return { inUse: false, tasksCount: 0, projectsCount: 0 };
        }
    }
}
